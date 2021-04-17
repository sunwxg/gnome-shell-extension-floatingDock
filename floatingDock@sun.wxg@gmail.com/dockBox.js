const { GLib, Clutter, Gio, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;
const DND = imports.ui.dnd;
const AppFavorites = imports.ui.appFavorites;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const ItemContainer = Me.imports.itemContainer.ItemContainer;
const ApplicationsButton = Me.imports.itemContainer.ApplicationsButton;
const NUMBER_TO_CHAR_UPPERCASE = Me.imports.util.NUMBER_TO_CHAR_UPPERCASE;
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;
const Util = Me.imports.util;
const ItemBox = Me.imports.itemBox.ItemBox;
const AroundButtonManager = Me.imports.aroundButton.AroundButtonManager;
const MainButton = Me.imports.mainButton.MainButton;

const ICON_FILE = 'floating-dock-icon-file';
const DOCK_POSITION = 'floating-dock-position';
const APP_LIST = 'floating-dock-app-list';
const USE_FAVORITES = 'floating-dock-icon-favorites';
const KEEP_OPEN = 'floating-dock-keep-open';
const INDICATOR = 'floating-dock-indicator';
const CURRENT_WORKSPACE = 'floating-dock-current-workspace-app';
const APPLICATIONS_BUTTON = 'floating-dock-applications-button';

var ITEM_ANIMATION_TIME = 200;

var WINDOW_DND_SIZE = 256;
var DRAGGING_WINDOW_OPACITY = 0;

var DockBox = GObject.registerClass({
    Signals: {
        'dock-updated': {},
    },
}, class DockBox extends St.BoxLayout {
    _init(params) {
        super._init({ name: 'floating-dock',
                      can_focus: true,
                      reactive: true,
                      x_align: Clutter.ActorAlign.CENTER });

        this.settings = params.settings;
        this.iconSize = params.iconSize;
        this.direction = params.direction;

        this._mainButton = new MainButton(params.iconSize, params.settings);
        this._mainButton._delegate = this;
        this._draggable = DND.makeDraggable(this._mainButton,
                                            { restoreOnSuccess: false,
                                              manualMode: false,
                                              dragActorMaxSize: WINDOW_DND_SIZE,
                                              dragActorOpacity: DRAGGING_WINDOW_OPACITY });
        this._draggable.connect('drag-begin', this._onDragBegin.bind(this));
        this._draggable.connect('drag-cancelled', this._onDragCancelled.bind(this));
        this._draggable.connect('drag-end', this._onDragEnd.bind(this));

        this._mainButton.connect('clicked', this._mainButtonClicked.bind(this));
        this._mainButton.connect('button-press-event', this._mainButtonPress.bind(this));

        this._mainButton.connect('notify::allocation', () => {
            let box = this._mainButton.get_allocation_box();
            this._mainButtonX = box.x1;
            this._mainButtonY = box.y1;
        });

        this._label = new St.Label({ style_class: 'dash-label',
                                     text: 'Press ESC to cancel' });
        this._label.hide();
        Main.layoutManager.addChrome(this._label);

        this._keepOpen = this.settings.get_boolean(KEEP_OPEN);
        this._showApp = this._keepOpen;

        this._vimMode = false;
        this._inDrag = false;
        this._inPreviewMode = false;
        this._inPreviewButton = null;
        this._timeoutId = 0;
        [this._mainButtonX, this._mainButtonY] = this.settings.get_value(DOCK_POSITION).deep_unpack();
        this._useFavorites = this.settings.get_boolean(USE_FAVORITES);
        this._appSystem = Shell.AppSystem.get_default();
        this._userApps = (this.settings.get_string(APP_LIST)).split(';');

        this._box = new ItemBox(this.direction);
        this.add_child(this._box);

        this._workId = Main.initializeDeferredWork(this, this._redisplay.bind(this));

        this._connectSignals();

        this.connect('style-changed', () => { this.queueRedisplay.bind(this) });
        this.connect('show', () => { this._showDock(false); });

        this.connect('dock-updated', () => {
            if (this._showApp)
                this._mainButton.showIcon(true);
            else
                this._mainButton.showIcon(false);
        });

        this._aroundButtonManager = new AroundButtonManager(this.iconSize, this._mainButton);

        Main.layoutManager.addChrome(this, { trackFullscreen: true });

        this._mainButton.set_position(this._mainButtonX, this._mainButtonY);
        this._monitorChanged();
    }

    _connectSignals() {
        this.keepOpenID = this.settings.connect("changed::" + KEEP_OPEN, () => {
            this._keepOpen = this.settings.get_boolean(KEEP_OPEN);
        });
        this.useFavoritesID = this.settings.connect("changed::" + USE_FAVORITES, () => {
            this._useFavorites = this.settings.get_boolean(USE_FAVORITES);
            this.queueRedisplay();
        });
        this.appListID = this.settings.connect("changed::" + APP_LIST, () => {
            this._userApps = (this.settings.get_string(APP_LIST)).split(';');
            this.queueRedisplay();
        });

        this._indicator = this.settings.get_value(INDICATOR).deep_unpack();
        this.indicatorChangedID = this.settings.connect("changed::" + INDICATOR, () => {
            this._indicator = this.settings.get_value(INDICATOR).deep_unpack();
            this.queueRedisplay();
        });

        this._currentWorkspaceApp = this.settings.get_boolean(CURRENT_WORKSPACE);
        this.currentWorkspaceAppID = this.settings.connect("changed::" + CURRENT_WORKSPACE, () => {
            this._currentWorkspaceApp = this.settings.get_boolean(CURRENT_WORKSPACE);
            this.queueRedisplay();
        });

        this._applicationButton = this.settings.get_boolean(APPLICATIONS_BUTTON);
        this.applicationButtonID = this.settings.connect("changed::" + APPLICATIONS_BUTTON, () => {
            this._applicationButton = this.settings.get_boolean(APPLICATIONS_BUTTON);
            this.queueRedisplay();
        });

        this.installChangedID = this._appSystem.connect('installed-changed', () => {
            AppFavorites.getAppFavorites().reload();
            this.queueRedisplay();
        });

        this.appFavoritesChangedID = AppFavorites.getAppFavorites().connect('changed', this.queueRedisplay.bind(this));
        this.appStateChangedID = this._appSystem.connect('app-state-changed', this.queueRedisplay.bind(this));

        this._overViewShownID = Main.overview.connect('showing', () => {
            this.hide();
            this._mainButton.hide(); });
        this._overViewHiddenID = Main.overview.connect('hiding', () => {
            this.show();
            this._mainButton.show(); });
        this._monitorChangedID = Main.layoutManager.connect('monitors-changed', this._monitorChanged.bind(this));

        this._workspaceChangedID = global.workspace_manager.connect('active-workspace-changed',
                                                                    this.queueRedisplay.bind(this));
    }

    _redisplay() {
        let children = this._box.get_children();
        children.map(actor => { actor.destroy(); });

        this._itemNumber = 0;
        if (this._useFavorites)
            this._addFavorites();
        else
            this._addCustomerApp();
        this._addApps();

        if (this._applicationButton)
            this._addApplicationButton();

        this._showDock(false);
    }

    queueRedisplay() {
        this._vimMode = false;
        if (this._mainButton)
            this._mainButton.reactive = true;
        //Main.queueDeferredWork(this._workId);
        this._redisplay();
    }

    _findInBox(app) {
        let children = this._box.get_children();
        let result = false;
        for (let i = 0; i < children.length; i++) {
            if (children[i].isApplicationButton)
                continue;
            if (children[i].app.id == app.id) {
                result = true;
                break;
            }
        }
        return result;
    }

    _addApps() {
        let running = this._appSystem.get_running();

        if (this._currentWorkspaceApp) {
            running = running.filter(function(app) {
                return Util.appInActiveWorkspace(app);
            });
        }

        for (let i = 0; i < running.length; i++) {
            if (this._findInBox(running[i]))
                continue;
            let item = new ItemContainer({
                app: running[i],
                vimMode: this._vimMode,
                number: this._itemNumber++,
                iconSize: this.iconSize,
                indicator: this._indicator,
                currentWorkspace: this._currentWorkspaceApp
            });
            item.button.connect('activate-window', this._activateWindow.bind(this));
            item.button.connect('in-preview', (button, state) => {
                this._inPreviewMode = state;
                if (state)
                    this._inPreviewButton = button;
            });

            this._box.add_child(item);
        }
    }

    _addFavorites() {
        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        for (let i in favorites) {
            let item = new ItemContainer({
                app: favorites[i],
                vimMode: this._vimMode,
                number: this._itemNumber++,
                iconSize: this.iconSize,
                indicator: this._indicator,
                currentWorkspace: this._currentWorkspaceApp
            });
            item.button.connect('activate-window', this._activateWindow.bind(this));
            item.button.connect('in-preview', (button, state) => {
                this._inPreviewMode = state;
                if (state)
                    this._inPreviewButton = button;
            });

            this._box.add_child(item);
        }
    }

    _addCustomerApp() {
        for (let i in this._userApps) {
            let application = this._appSystem.lookup_app(this._userApps[i]);
            let item = new ItemContainer({
                app: application,
                vimMode: this._vimMode,
                number: this._itemNumber++,
                iconSize: this.iconSize,
                indicator: this._indicator,
                currentWorkspace: this._currentWorkspaceApp
            });
            item.button.connect('activate-window', this._activateWindow.bind(this));
            item.button.connect('in-preview', (button, state) => {
                this._inPreviewMode = state;
                if (state)
                    this._inPreviewButton = button;
            });

            this._box.add_child(item);
        }
    }

    _addApplicationButton() {
        let button = new ApplicationsButton(this.iconSize); 
        button.connect('activate-window', this._activateWindow.bind(this));
        this._box.add_child(button);
    }

    _activateWindow() {
        this._showApp = this._keepOpen;
        this._showDock(false);
    }

    _previewSelected(number) {
        let children = this._box.get_children();
        let window = null;
        children.forEach( (item) => {
            if (item.isApplicationButton)
                return;

            let w = item.button.findPreviewMenu(number);
            if (w != null)
                window = w;
        });

        if (!window)
            return;

        this.activateWindow(window);
        this._hideAppList();
    }

    _appItemSelected(number, newWindow) {
        let children = this._box.get_children();
        let item = children.find( (element) => {
            if (element.isApplicationButton)
                return false;
            return element.number == number;
        });

        if (!item)
            return;

        let windows = this._currentWorkspaceApp ? Util.windowsInActiveWorkspace(item.button.app)
                                                : item.button.app.get_windows();
        if (newWindow || (windows.length == 0)) {
            item.button.newWindow = newWindow;
            item.button.app.open_new_window(-1);
        } else if ( windows.length == 1) {
            this.activateWindow(windows[0]);
        }  else if (windows.length > 1) {
            this._inPreviewMode = true;
            item.button._showPreviews();
            return;
        }

        this._hideAppList();
    }

    activateWindow(window) {
        let focusWindow = global.display.get_focus_window();
        if (window == focusWindow)
            window.minimize();
        else
            Main.activateWindow(window);
    }

    _mainButtonClicked() {
        this._showApp = !this._showApp;
        this._showDock(true);
    }

    _mainButtonPress(actor, event) {
        if (event.get_button() == 3) {
            if (this._showApp) {
                this._showApp = false;
                this._showDock(false);
            }

            this._aroundButtonManager.popup();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _hideAppList() {
        this._showApp = this._keepOpen;
        this._vimMode = false;
        this._mainButton.reactive = true;
        Main.popModal(this);
        this._redisplay();
    }

    _showDock(animation) {
        if (this._showApp) {
            this.show();
            this.set_position(this._mainButtonX, this._mainButtonY);

            if (animation) {
                this._box.setSlide(0);
                this._box.ease_property('@layout.slide', 1, {
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    duration: ITEM_ANIMATION_TIME, });
            } else
                this._box.setSlide(1);

        } else {
            this.set_position(this._mainButtonX, this._mainButtonY);
            if (animation) {
                this._box.setSlide(1);
                this._box.ease_property('@layout.slide', 0, {
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    duration: ITEM_ANIMATION_TIME,
                    onComplete: () => this.hide() });
            } else
                this.hide();
        }

        if (this._vimMode)
            this._showLabel();
        else
            this._label.hide();

        this._recordMainButtonPosition();
        this.emit('dock-updated');
    }

    _recordMainButtonPosition() {
        if (this._timeoutId != 0)
            return;

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
            this._timeoutId = 0;

            if (!this._mainButton)
                return;

            let box = this._mainButton.get_allocation_box();
            this.settings.set_value(DOCK_POSITION,
                                new GLib.Variant('ai', [box.x1 ,box.y1]));

            return GLib.SOURCE_REMOVE;
        });
    }

    _showLabel() {
        this._label.show();
        let labelHeight = this._label.get_height();
        let labelWidth = this._label.get_width();
        let boxWidth = this.get_width();
        let boxHeight = this.get_height();

        const box = this._mainButton.get_transformed_extents();
        let sourceTopLeft = box.get_top_left();
        let sourceBottomRight = box.get_bottom_right();
        let x = sourceTopLeft.x;
        let y = sourceTopLeft.y;

        switch (this.direction) {
        case St.Side.TOP:
        case St.Side.BOTTOM:
            x = x - labelWidth;
            if (x < 0)
                x = sourceBottomRight.x;
            break;
        case St.Side.RIGHT:
        case St.Side.LEFT:
            y = y - labelHeight;
            if (y < 0)
                y = sourceBottomRight.y;
        default:
            break;
        }
        this._label.set_position(x, y);
    }

    showItem() {
        this._vimMode = true;
        this._mainButton.reactive = false;
        if (!this._showApp) {
            this._showApp = true;
            this.show();
        }

        this._aroundButtonManager.popupClose();

        Main.queueDeferredWork(this._workId);

        Main.pushModal(this);
    }

    _monitorChanged() {
        let workspaceManager = global.workspace_manager;
        let ws = workspaceManager.get_active_workspace();
        let workArea = ws.get_work_area_all_monitors();

        let mainButtonBox = this._mainButton.get_allocation_box();
        let mainButtonWidth = mainButtonBox.x2 - mainButtonBox.x1;
        let mainButtonHeight = mainButtonBox.y2 - mainButtonBox.y1;

        let x = mainButtonBox.x1;
        let y = mainButtonBox.y1;

        if (mainButtonBox.x2 > workArea.x + workArea.width)
            x = workArea.x + workArea.width - mainButtonWidth;
        if (mainButtonBox.y2 > workArea.y + workArea.height)
            y = workArea.y + workArea.height - mainButtonHeight;

        this._mainButton.set_position(x, y);
    }

    _sureInWorkArea(box) {
        let workspaceManager = global.workspace_manager;
        let ws = workspaceManager.get_active_workspace();
        let workArea = ws.get_work_area_all_monitors();

        let boxWidth = box.x2 - box.x1;
        let boxHeight = box.y2 - box.y1;

        let mainButtonBox = this._mainButton.get_allocation_box();
        let mainButtonWidth = mainButtonBox.x2 - mainButtonBox.x1;
        let mainButtonHeight = mainButtonBox.y2 - mainButtonBox.y1;

        let x = box.x1;
        let y = box.y1;

        switch (this.direction) {
        case St.Side.TOP:
            if (box.x1 < workArea.x)
                x = workArea.x;
            else if (box.x2 > (workArea.x + workArea.width))
                x = workArea.x + workArea.width - boxWidth;

            if (box.y1 < workArea.y)
                y = workArea.y;

            if ((boxHeight + mainButtonHeight) > workArea.height ||
                (box.y2 + mainButtonHeight) > (workArea.y + workArea.height))
                y = workArea.y + workArea.height - boxHeight - mainButtonHeight;

            this._mainButton.set_position(x, y + boxHeight);
            break;
        case St.Side.BOTTOM:
            if (box.x1 < workArea.x)
                x = workArea.x;
            else if (box.x2 > (workArea.x + workArea.width))
                x = workArea.x + workArea.width - boxWidth;

            if (box.y2 > (workArea.y + workArea.height))
                y = workArea.y + workArea.height - boxHeight;

            if ((boxHeight + mainButtonHeight) > workArea.height ||
                (box.y1 - mainButtonHeight) < workArea.y)
                y = workArea.y + mainButtonHeight;

            this._mainButton.set_position(x, y - mainButtonHeight);
            break;
        case St.Side.LEFT:
            if (box.x1 < workArea.x)
                x = workArea.x;

            if (boxWidth + mainButtonWidth >  workArea.width ||
                box.x1 + boxWidth + mainButtonWidth > workArea.x + workArea.width)
                x = workArea.x + workArea.width - boxWidth - mainButtonWidth;

            if (box.y1 < workArea.y)
                y = workArea.y;
            else if (box.y2 > (workArea.y + workArea.height))
                y = workArea.y + workArea.height - boxHeight;

            this._mainButton.set_position(x + boxWidth, y);
            break;
        case St.Side.RIGHT:
            if (box.x2 > (workArea.x + workArea.width))
                x = workArea.x + workArea.width - boxWidth;

            if (boxWidth + mainButtonWidth >  workArea.width ||
                box.x1 - mainButtonWidth < workArea.x)
                x = workArea.x + mainButtonWidth;

            if (box.y1 < workArea.y)
                y = workArea.y;
            else if (box.y2 > (workArea.y + workArea.height))
                y = workArea.y + workArea.height - boxHeight;

            this._mainButton.set_position(x - mainButtonWidth, y);
        default:
            break;
        }
        box.set_origin(x, y);
    }

    vfunc_allocate(box) {
        super.vfunc_allocate(box);

        let boxWidth = box.x2 - box.x1;
        let boxHeight = box.y2 - box.y1;

        let mainButtonBox = this._mainButton.get_allocation_box();
        let mainButtonWidth = mainButtonBox.x2 - mainButtonBox.x1;
        let mainButtonHeight = mainButtonBox.y2 - mainButtonBox.y1;

        let x = box.x1;
        let y = box.y1;

        switch (this.direction) {
        case St.Side.TOP:
            x = this._mainButtonX;
            y = this._mainButtonY - boxHeight;
            break;
        case St.Side.LEFT:
            x = this._mainButtonX - boxWidth;
            y = this._mainButtonY;
            break;
        case St.Side.BOTTOM:
            x = this._mainButtonX;
            y = this._mainButtonY + mainButtonHeight;
            break;
        case St.Side.RIGHT:
            x = this._mainButtonX + mainButtonWidth;
            y = this._mainButtonY;
        default:
            break;
        }

        box.set_origin(x, y);
        if (!this._inDrag)
            this._sureInWorkArea(box);
        this.set_allocation(box);
    }

    vfunc_key_press_event(keyEvent) {
        let symbol = keyEvent.keyval;
        if (symbol == Clutter.KEY_Escape && this._inPreviewMode) {
            this._inPreviewButton._previewMenu.close();
            return Clutter.EVENT_STOP;
        }

        if (symbol == Clutter.KEY_Escape) {
            this._inPreviewMode = false;
            this._hideAppList();
            return Clutter.EVENT_STOP;
        }

        let number = NUMBER_TO_CHAR.findIndex( (element) => {
                                                return element == symbol; });
        if (number >= 0) {
            if (this._inPreviewMode)
                this._previewSelected(number);
            else
                this._appItemSelected(number, false);

            return Clutter.EVENT_STOP;
        }

        number = NUMBER_TO_CHAR_UPPERCASE.findIndex( (element) => {
                                                return element == symbol; });
        if (number >= 0 && !this._inPreviewMode) {
            this._appItemSelected(number, true);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_STOP;
    }

    _onDragMotion(dropEvent) {
        this._inDrag = true;
        this._mainButton.set_position(dropEvent.dragActor.x, dropEvent.dragActor.y);

        this._showDock(false);
        return DND.DragMotionResult.CONTINUE;
    }

    _onDragBegin(_draggable, _time) {
        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this),
        };
        DND.addDragMonitor(this._dragMonitor);
    }

    _onDragCancelled(_draggable, _time) {
        this._inDrag = false;
    }

    _onDragEnd(_draggable, _time, _snapback) {
        this._inDrag = false;
        DND.removeDragMonitor(this._dragMonitor);

        this._showDock(false);
        this._updateMenuStyle();
    }

    getDragActor() {
        return this._mainButton.createDragButton();
    }

    getDragActorSource() {
        return this._mainButton;
    }

    acceptDrop() {
        return true;
    }

    _updateMenuStyle() {
        let children = this._box.get_children();
        children.forEach( (item) => {
            if (item.isApplicationButton)
                return;
            let button = item.button;
            if (button._previewMenu != null) {
                button._previewMenu.destroy();
                button._previewMenu = null;
            }
        });
    }

    destroy() {
        if (this._timeoutId)
            GLib.source_remove(this._timeoutId);

        if (this._overViewShownID)
            Main.overview.disconnect(this._overViewShownID);
        if (this._overViewHiddenID)
            Main.overview.disconnect(this._overViewHiddenID);
        if (this._monitorChangedID)
            Main.layoutManager.disconnect(this._monitorChangedID);
        if (this._workspaceChangedID)
            global.workspace_manager.disconnect(this._workspaceChangedID);

        if (this.keepOpenID)
            this.settings.disconnect(this.keepOpenID);
        if (this.iconFileID)
            this.settings.disconnect(this.iconFileID);
        if (this.useFavoritesID)
            this.settings.disconnect(this.useFavoritesID);
        if (this.appListID)
            this.settings.disconnect(this.appListID);
        if (this.indicatorChangedID)
            this.settings.disconnect(this.indicatorChangedID);
        if (this.currentWorkspaceAppID)
            this.settings.disconnect(this.currentWorkspaceAppID);
        if (this.applicationButtonID)
            this.settings.disconnect(this.applicationButtonID);
        if (this.installChangedID)
            this._appSystem.disconnect(this.installChangedID);
        if (this.appFavoritesChangedID)
            AppFavorites.getAppFavorites().disconnect(this.appFavoritesChangedID);
        if (this.appStateChangedID)
            this._appSystem.disconnect(this.appStateChangedID);

        this._aroundButtonManager.destroy();
        Main.layoutManager.removeChrome(this._label);
        Main.layoutManager.removeChrome(this);
        this._mainButton.destroy();
    }
});
