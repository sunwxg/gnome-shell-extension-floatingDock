const { Clutter, GObject, Shell, St } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const AppDisplay = imports.ui.appDisplay;
const IconGrid = imports.ui.iconGrid;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;
const Util = Me.imports.util;
const WindowPreview = Me.imports.windowPreview;
const CreateNumberIcon = Me.imports.numberIcon.createNumberIcon;

var PanelAppIcon = GObject.registerClass({
}, class PanelAppIcon extends St.Widget {
    _init(app, vimMode, number, iconSize) {
        super._init();

        this.app = app;
        this.iconSize = iconSize;

        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._icon.destroy_all_children();
        this.add_child(this._icon);

        let appicon = this.app.create_icon_texture(this.iconSize);
        this._icon.add_child(appicon);

        if (vimMode)
            this._icon.add_child(CreateNumberIcon(number, this.iconSize));
    }
});

var MyAppButton = GObject.registerClass({
    Signals: {
        'activate-window': {},
        'in-preview': { param_types: [GObject.TYPE_BOOLEAN] },
    },
}, class MyAppButton extends St.Button {
    _init(app, vimMode, number, iconSize) {
        super._init({ label: app.get_name(),
                      style_class: 'app-button',
                      y_align: Clutter.ActorAlign.CENTER,
                      reactive: vimMode ? false : true,
        });

        this.set_child(new PanelAppIcon(app, vimMode, number, iconSize));
        this.app = app;
        this.iconSize = iconSize;
        this.vimMode = vimMode;

        this._previewMenuManager = new PopupMenu.PopupMenuManager(this);
        this._previewMenu = null;

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = null;
    }

    vfunc_button_press_event(buttonEvent) {
        super.vfunc_button_press_event(buttonEvent);

        if (buttonEvent.button == 3) {
            if (this._previewMenu && this._previewMenu.isOpen)
                return Clutter.EVENT_PROPAGATE;

            this._popupMenu();
            return Clutter.EVENT_STOP;
        } else if (buttonEvent.button == 1) {
            this.leftButtonClicked();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    leftButtonClicked() {
        let openNewWindow = this.app.can_open_new_window() &&
                            !Util.appInActiveWorkspace(this.app);
        let windows = Util.windowsInActiveWorkspace(this.app);

        if (openNewWindow) {
            this.app.open_new_window(-1);
            this.emit('activate-window');
        } else if (windows.length == 1) {
            this.activateWindow(windows[0]);
        } else {
            this._showPreviews();
        }
    }

    _showPreviews() {
        if (!this._previewMenu) {
            this._previewMenu = new WindowPreview.WindowPreviewMenu(this, this.iconSize);
            this._previewMenu.connect('open-state-changed',
                                      (menu, state) => { this.emit('in-preview', state); });

            this._previewMenuManager.addMenu(this._previewMenu, St.Side.LEFT);
        }

        if (this._previewMenu.isOpen) {
            this._previewMenu.close();
        } else {
            this._previewMenu.popup();
            this._previewMenuManager.ignoreRelease();
        }

        return false;
    }

    _popupMenu() {
        if (!this._menu) {
            this._menu = new AppDisplay.AppIconMenu(this.actor);
            this._menu.connect('activate-window', (menu, window) => {
                this.activateWindow(window); });

            this._menuManager.addMenu(this._menu);
        }

        this._menu.popup();
        this._menuManager.ignoreRelease();

        return false;
    }

    findPreviewMenu(number) {
        if (this._previewMenu == null)
            return null;

        let items = this._previewMenu._menuSection._getMenuItems();
        let menuItem = items.find( (element) => {
            return element._number == number; });

        if (menuItem)
            return menuItem._window;

        return null;
    }

    activateWindow(metaWindow) {
        if (metaWindow)
            Main.activateWindow(metaWindow);

        this.emit('activate-window');
    }

    animateLaunch() {
    }
});

var ItemContainer = GObject.registerClass(
class ItemContainer extends St.Widget {
    _init(app, vimMode, number, iconSize) {
        super._init({ style_class: 'item-container',
                      layout_manager: new Clutter.BinLayout(),
                      x_expand: true,
                      y_expand: true,
                      reactive: vimMode ? false : true,
                      track_hover: vimMode ? false : true,
        });

        this.app = app;
        this.number = number;

        let button = new MyAppButton(app, vimMode, number, iconSize);

        this.add_child(button);
        this.child = button;

        this._dot = new St.Widget({ style_class: 'app-running-dot',
                                    x_expand: true,
                                    y_expand: true,
                                    x_align: Clutter.ActorAlign.CENTER,
                                    y_align: Clutter.ActorAlign.END, });
        this.add_child(this._dot);

        this._stateChangedId = this.app.connect('windows-changed', () => {
            this._updateRunningStyle();
        });
        this._updateRunningStyle();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _updateRunningStyle() {
        if (this.app.state != Shell.AppState.STOPPED &&
            Util.appInActiveWorkspace(this.app))
            this._dot.show();
        else
            this._dot.hide();
    }

    _onDestroy() {
        if (this._stateChangedId > 0)
            this.app.disconnect(this._stateChangedId);
    }
});
