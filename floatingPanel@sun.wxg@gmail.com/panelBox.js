const { Clutter, Gio, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;
const DND = imports.ui.dnd;
const AppFavorites = imports.ui.appFavorites;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const ItemContainer = Me.imports.itemContainer.ItemContainer;
const SwitchWorkspace = Me.imports.switchWorkspace.SwitchWorkspace;
const NUMBER_TO_CHAR_UPPERCASE = Me.imports.util.NUMBER_TO_CHAR_UPPERCASE;
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;
const Util = Me.imports.util;

var ICON_SIZE = 48;
var ITEM_ANIMATION_TIME = 1000;

var WINDOW_DND_SIZE = 256;
var DRAGGING_WINDOW_OPACITY = 0;

var DragDropResult = {
    FAILURE:  0,
    SUCCESS:  1,
    CONTINUE: 2,
};

var PanelBox = GObject.registerClass({
    Signals: {
        'size-changed': {},
    },
}, class PanelBox extends St.BoxLayout {
    _init(direction) {
        super._init({ name: 'floating-panel',
                      can_focus: true,
                      reactive: true,
                      x_align: Clutter.ActorAlign.CENTER });

        this.direction = direction;
        switch (direction) {
        case St.Side.TOP:
        case St.Side.BOTTOM:
            this.set_vertical(true);
            break;
        case St.Side.LEFT:
        case St.Side.RIGHT:
            this.set_vertical(false);
            break;
        default:
            break;
        }

        this._mainButton = this._createMainButton();
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
        let switchWorkspace = new SwitchWorkspace();
        this._mainButton.connect('scroll-event', switchWorkspace.scrollEvent.bind(switchWorkspace));

        this.add_child(this._mainButton)

        this._label = new St.Label({ style_class: 'dash-label',
                                     text: 'Press ESC to cancel' });
        this._label.hide();
        Main.layoutManager.addChrome(this._label);
        this.label_actor = this._label;

        let [x, y] =global.get_pointer();
        this._x = x;
        this._y = y;

        this._showApp = false;
        this._vimMode = false;

        this._box = new ItemBox(this.direction);
        switch (direction) {
        case St.Side.LEFT:
        case St.Side.TOP:
            this.insert_child_below(this._box, null);
            break;
        case St.Side.BOTTOM:
        case St.Side.RIGHT:
            this.insert_child_above(this._box, null);
            break;
        default:
            break;
        }

        this._workId = Main.initializeDeferredWork(this, this._redisplay.bind(this));

        this._appSystem = Shell.AppSystem.get_default();

        this._appSystem.connect('installed-changed', () => {
            AppFavorites.getAppFavorites().reload();
            this.queueRedisplay();
        });

        AppFavorites.getAppFavorites().connect('changed', this.queueRedisplay.bind(this));
        this._appSystem.connect('app-state-changed', this.queueRedisplay.bind(this));

        this._overViewShownID = Main.overview.connect('showing', () => { this.hide() });
        this._overViewHiddenID = Main.overview.connect('hiding', () => { this.show() });

        this._workspaceChangedID = global.workspace_manager.connect('active-workspace-changed',
                                                                    this.queueRedisplay.bind(this));
        Main.layoutManager.addChrome(this, { trackFullscreen: true });
    }

    _createMainButton() {
        let gicon = new Gio.FileIcon({
                    file: Gio.File.new_for_path(Me.path + '/icons/flag.png') });
        let icon = new St.Icon({ gicon: gicon,
                                 icon_size: ICON_SIZE });

        let button= new St.Button({ style_class: 'main-button',
                                    child: icon });

        return button;
    }

    _getDragButton() {
        let gicon = new Gio.FileIcon({
                    file: Gio.File.new_for_path(Me.path + '/icons/flag.png') });
        let icon = new St.Icon({ gicon: gicon,
                                 icon_size: ICON_SIZE });

        let button= new St.Button({ style_class: 'item-container',
                                    child: icon });

        return button;
    }

    _updatePositionRedisplay(oldLength, oldWidth, oldHeight){
        let [x, y] = this.get_position();
        let children = this._box.get_children();
        let newWidth = (oldWidth / oldLength) * children.length;
        let newHeight = (oldHeight / oldLength) * children.length;

        switch (this.direction) {
        case St.Side.TOP:
            this._y = y - (newHeight - oldHeight);
            break;
        case St.Side.LEFT:
            this._x = x - (newWidth - oldWidth);
            break;
        case St.Side.BOTTOM:
        case St.Side.RIGHT:
        default:
            break;
        }

        if (this._showApp)
            this._sureInWorkArea();
    }

    _redisplay() {
        let oldLength = this._box.get_children().length;
        let box = this._box.get_allocation_box();
        let oldWidth = box.x2 - box.x1;
        let oldHeight = box.y2 - box.y1;

        let children = this._box.get_children();
        children.map(actor => { actor.destroy(); });

        this._itemNumber = 0;
        this._getFavorites();
        this._addApps();

        if ((oldLength != this._box.get_children().length) &&
            this._showApp && !this._vimMode)
            this._updatePositionRedisplay(oldLength, oldWidth, oldHeight);

        this._showPanel(this._x, this._y);
    }

    _findInBox(app) {
        let children = this._box.get_children();
        let result = false;
        for (let i = 0; i < children.length; i++) {
            if (children[i].app.id == app.id) {
                result = true;
                break;
            }
        }
        return result;
    }

    _addApps() {
        this._appSystem = Shell.AppSystem.get_default();
        let running = this._appSystem.get_running();

        running = running.filter(function(app) {
            return Util.appInActivateWorkspace(app);
        });

        for (let i = 0; i < running.length; i++) {
            if (this._findInBox(running[i]))
                continue;

            let item = new ItemContainer(running[i], this._vimMode, this._itemNumber++);
            //item.child.connect('clicked', this._appButtonClicked.bind(this));
            //item.child.connect('activate-window', this._appButtonClicked.bind(this));
            item.child.connect('activate-window', this._activateWindow.bind(this));

            this._box.add_child(item);
        }
    }

    _getFavorites() {
        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        for (let i in favorites) {
            let item = new ItemContainer(favorites[i], this._vimMode, this._itemNumber++);
            //item.child.connect('clicked', this._appButtonClicked.bind(this));
            //item.child.connect('activate-window', this._appButtonClicked.bind(this));
            item.child.connect('activate-window', this._activateWindow.bind(this));
            this._box.add_child(item);
        }
    }

    //_appButtonClicked(button) {
        //print("wxg: _appButtonClicked");
        //this._showApp = false;
        //this._updatePosition('hide');
    //}

    _activateWindow() {
        print("wxg: _activateWindow");
        this._showApp = false;
        this._updatePosition('hide');
        this._showPanel(this._x, this._y);
    }

    _appItemSelected(number, newWindow) {
        let children = this._box.get_children();
        let item = children.find( (element) => {
            return element.number == number;
        });

        if (!item)
            return;

        if (newWindow) {
            item.child.newWindow = newWindow;
            item.child.leftButtonClicked();
            //item.child.emit('clicked', item.child);
        } else {
            item.child.app.activate();
        }

        this._showApp = false;
        this._vimMode = false;
        this._mainButton.set_button_mask(3);
        Main.popModal(this);
        this._updatePosition('hide');
        this._redisplay();
    }

    _updatePosition(action) {
        let box = this._box.get_allocation_box();
        let boxWidth = box.x2 - box.x1;
        let boxHeight = box.y2 - box.y1;
        let [x, y] = this.get_position();
        switch (this.direction) {
        case St.Side.TOP:
            this._y = y - boxHeight;
            if (action == 'show')
                this._y = y - boxHeight;
            else
                this._y = y + boxHeight;
            break;
        case St.Side.LEFT:
            if (action == 'show')
                this._x = x - boxWidth;
            else
                this._x = x + boxWidth;
            break;
        case St.Side.BOTTOM:
        case St.Side.RIGHT:
        default:
            break;
        }

        if (action == 'show')
            this._sureInWorkArea();
    }

    _sureInWorkArea() {
        let workspaceManager = global.workspace_manager;
        let ws = workspaceManager.get_active_workspace();
        let workArea = ws.get_work_area_all_monitors();

        let box = this._box.get_allocation_box();
        let mainButton = this._mainButton.get_allocation_box();
        let width = box.x2 - box.x1 + mainButton.x2 - mainButton.x1;
        let height = box.y2 - box.y1 + mainButton.y2 - mainButton.y1;

        switch (this.direction) {
        case St.Side.TOP:
            this._y = this._y < workArea.y ? workArea.y : this._y;
            if (this._y + height > workArea.y + workArea.height)
                this._y = workArea.y + workArea.height - height;
            break;
        case St.Side.BOTTOM:
            if (this._y + height > workArea.y + workArea.height)
                this._y = workArea.y + workArea.height - height;
            this._y = this._y < workArea.y ? workArea.y : this._y;
            break;
        case St.Side.LEFT:
            this._x = this._x < workArea.x ? workArea.x : this._x;
            if (this._x + width > workArea.x + workArea.width)
                this._x = workArea.x + workArea.width - width;
            break;
        case St.Side.RIGHT:
            if (this._x + width > workArea.x + workArea.width)
                this._x = workArea.x + workArea.width - width;
            this._x = this._x < workArea.x ? workArea.x : this._x;
            break;
        default:
            break;
        }
    }

    _mainButtonClicked() {
        this._showApp = !this._showApp;
        if (this._showApp) {
            this._box.show();
            this._updatePosition('show');
            this._sureInWorkArea();
            //this._boxAnimation();
        } else {
            //this._box.hide();
            this._updatePosition('hide');
        }
        this._showPanel(this._x, this._y);
    }

    _showPanel(x, y) {
        this._x = x;
        this._y = y;

        this.set_position(this._x, this._y);

        if (this._showApp) {
            this._box.show();
            //this._boxAnimation(this._box.show);
        } else {
            //this._boxAnimation();
            this._box.hide();
        }

        if (this._vimMode)
            this._showLabel();
        else
            this._label.hide();
    }

    _showLabel() {
        this._label.show();
        let labelHeight = this._label.get_height();
        let labelWidth = this._label.get_width();
        let boxWidth = this.get_width();
        let boxHeight = this.get_height();

        let x, y;
        switch (this.direction) {
        case St.Side.TOP:
        case St.Side.BOTTOM:
            x = this._x - labelWidth;
            if (x < 0)
                x = this._x + boxWidth;
            y = this._y;
            break;
        case St.Side.RIGHT:
        case St.Side.LEFT:
            x = this._x;
            y = this._y - labelHeight;
            if (y < 0)
                y = this._y + boxHeight;
            break;
        default:
            break;
        }
        this._label.set_position(x, y);
    }

    showItem() {
        this._vimMode = true;
        this._mainButton.set_button_mask(0);
        if (!this._showApp) {
            this._showApp = true;
            this._box.show();
            this._updatePosition('show');
        }
        Main.queueDeferredWork(this._workId);

        Main.pushModal(this);
    }

    vfunc_key_press_event(keyEvent) {
        let symbol = keyEvent.keyval;
        if (symbol == Clutter.KEY_Escape) {
            Main.popModal(this);
            this._showApp = false;
            this._vimMode = false;
            this._mainButton.set_button_mask(3);
            this._updatePosition('hide');
            this._redisplay();
            return Clutter.EVENT_STOP;
        }

        let number = NUMBER_TO_CHAR.findIndex( (element) => {
                                                return element == symbol; });
        if (number >= 0) {
            this._appItemSelected(number, false);
            return Clutter.EVENT_STOP;
        }

        number = NUMBER_TO_CHAR_UPPERCASE.findIndex( (element) => {
                                                return element == symbol; });
        if (number >= 0)
            this._appItemSelected(number, true);

        return Clutter.EVENT_STOP;
    }

    _boxAnimation() {
        let fullWidth = this.get_width();
        let fullHeight = this.get_height();

        this._box.ease({
            //opacity: 255,
            //width: fullWidth,
            height: fullHeight,
            duration: ITEM_ANIMATION_TIME,
            delay: ITEM_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._showPanel(this._x, this._y),
        });

        //let factor = 1.0;
        //this.ease_property('@effects.desaturate.factor', factor, {
            //duration: 500, // ms
            //mode: Clutter.AnimationMode.EASE_OUT_QUAD
        //});
    }

    queueRedisplay() {
        print("wxg: queueRedisplay");
        this._vimMode = false;
        this._mainButton.set_button_mask(3);
        Main.queueDeferredWork(this._workId);
    }

    _onDragMotion(dropEvent) {
        let lastX, lastY;
        switch (this.direction) {
        case St.Side.TOP:
            [lastX, lastY] = this._mainButton.get_position();
            this._x = dropEvent.dragActor.x;
            this._y = dropEvent.dragActor.y - lastY;
            break;
        case St.Side.LEFT:
            [lastX, lastY] = this._mainButton.get_position();
            this._x = dropEvent.dragActor.x - lastX;
            this._y = dropEvent.dragActor.y;
            break;
        case St.Side.BOTTOM:
        case St.Side.RIGHT:
            this._x = dropEvent.dragActor.x;
            this._y = dropEvent.dragActor.y;
        default:
            break;
        }

        //this._showPanel(dropEvent.dragActor.x, dropEvent.dragActor.y);
        this._showPanel(this._x, this._y);
        return DND.DragMotionResult.CONTINUE;
    }

    _onDragBegin(_draggable, _time) {
        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this),
        };
        DND.addDragMonitor(this._dragMonitor);
    }

    _onDragCancelled(_draggable, _time) {
    }

    _onDragEnd(_draggable, _time, _snapback) {
        DND.removeDragMonitor(this._dragMonitor);

        if (this._showApp)
            this._sureInWorkArea();
        this._showPanel(this._x, this._y);
        this._updateMenuStyle();
    }

    getDragActor() {
        return this._getDragButton();
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
            let button = item.child;
            if (button._previewMenu != null) {
                button._previewMenu.destroy();
                button._previewMenu = null;
            }
        });
    }

    destroy() {
        if (this._overViewShownID)
            Main.overview.disconnect(this._overViewShownID);
        if (this._overViewHiddenID)
            Main.overview.disconnect(this._overViewHiddenID);
        if (this._workspaceChangedID)
            global.workspace_manager.disconnect(this._workspaceChangedID);

        Main.layoutManager.removeChrome(this._label);
        Main.layoutManager.removeChrome(this);
    }
});

var ItemBox = GObject.registerClass(
class ItemBox extends St.BoxLayout {
    _init(direction) {
        super._init({ style_class: 'item-box' });

        switch (direction) {
        case St.Side.TOP:
        case St.Side.BOTTOM:
            this.set_vertical(true);
            break;
        case St.Side.LEFT:
        case St.Side.RIGHT:
            this.set_vertical(false);
            break;
        default:
            break;
        }
    }
});
