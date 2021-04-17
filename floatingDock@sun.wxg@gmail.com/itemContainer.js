const { Clutter, GObject, Shell, St } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const AppDisplay = imports.ui.appDisplay;
const IconGrid = imports.ui.iconGrid;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;
const Util = Me.imports.util;
const WindowPreview = Me.imports.windowPreview;
const CreateNumberIcon = Me.imports.numberIcon.createNumberIcon;
const Indicator = Me.imports.indicator;

var MyAppIcon = GObject.registerClass({
}, class MyAppIcon extends St.Widget {
    _init(params) {
        super._init();

        this.app = params.app;
        this.iconSize = params.iconSize;

        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._icon.destroy_all_children();
        this.add_child(this._icon);

        let appicon = this.app.create_icon_texture(this.iconSize);
        this._icon.add_child(appicon);

        if (params.vimMode)
            this._icon.add_child(CreateNumberIcon(params.number, this.iconSize));
    }
});

var MyAppButton = GObject.registerClass({
    Signals: {
        'activate-window': {},
        'in-preview': { param_types: [GObject.TYPE_BOOLEAN] },
    },
}, class MyAppButton extends St.Button {
    _init(params) {
        super._init({ label: params.app.get_name(),
                      style_class: 'app-button',
                      y_align: Clutter.ActorAlign.CENTER,
                      reactive: params.vimMode ? false : true,
        });

        this.set_child(new MyAppIcon({
            app: params.app,
            vimMode: params.vimMode,
            number: params.number,
            iconSize: params.iconSize,
        }));
        this.app = params.app;
        this.iconSize = params.iconSize;
        this.vimMode = params.vimMode;
        this.currentWorkspace = params.currentWorkspace;
        this.time = 0;

        this.set_pivot_point(0.5, 0.5);
        this.connect('notify::hover', this._onHover.bind(this));

        this._previewMenuManager = new PopupMenu.PopupMenuManager(this);
        this._previewMenu = null;

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = null;
    }

    vfunc_button_press_event(buttonEvent) {
        if (buttonEvent.button == 3) {
            if (this._previewMenu && this._previewMenu.isOpen)
                return Clutter.EVENT_PROPAGATE;

            this._popupMenu();
        } else if (buttonEvent.button == 1) {
            this.leftButtonClicked();
        }

        return Clutter.EVENT_STOP;
    }

    vfunc_scroll_event(scrollEvent) {
        let gap = scrollEvent.time - this.time;
        if (gap < 500 && gap >= 0)
            return;

        this.time = scrollEvent.time;
        this._switchWindows();

        return Clutter.EVENT_STOP;
    }

    _switchWindows() {
        let currentWorkspace = global.workspace_manager.get_active_workspace();

        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, currentWorkspace);
        windows.map(w => {
            return w.is_attached_dialog() ? w.get_transient_for() : w;
        }).filter((w, i, a) => !w.skip_taskbar && a.indexOf(w) == i);

        if (windows.length <= 1)
            return;

        windows[windows.length - 1].activate(global.get_current_time());
    }

    leftButtonClicked() {
        let openNewWindow, windows;
        if (this.currentWorkspace) {
            openNewWindow = this.app.can_open_new_window() &&
                                !Util.appInActiveWorkspace(this.app);
            windows = Util.windowsInActiveWorkspace(this.app);
        } else {
            openNewWindow = this.app.can_open_new_window() &&
                                !Util.appIsOpen(this.app);
            windows = this.app.get_windows();
        }

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

    _onHover() {
        let scale;
        if (this.hover) {
            scale = 0.8;
        } else {
            scale = 1;
        }

        this.ease({
            scale_x: scale,
            scale_y: scale,
        });
    }

    _popupMenu() {
        if (!this._menu) {
            this._menu = new AppDisplay.AppIconMenu(this, St.Side.LEFT);
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
        this.emit('activate-window');

        if (metaWindow && !this.currentWorkspace && !Util.windowInActiveWorkspace(metaWindow)) {
            metaWindow.get_workspace().activate(global.get_current_time());
            Main.activateWindow(metaWindow);
            return;
        }

        if (metaWindow) {
            let focusWindow = global.display.get_focus_window();
            if (metaWindow == focusWindow)
                metaWindow.minimize();
            else
                Main.activateWindow(metaWindow);
        }
    }

    animateLaunch() {
        //Used for Icon button right click
    }
});

var ItemContainer = GObject.registerClass(
class ItemContainer extends St.Widget {
    _init(params) {
        super._init({
            style_class: 'item-container',
            layout_manager: new Clutter.BinLayout(), });

        let buttonBox = new St.Widget({ style_class: 'button-box',
                      layout_manager: new Clutter.BinLayout(),
                      x_expand: true,
                      y_expand: true,
                      reactive: params.vimMode ? false : true,
                      track_hover: params.vimMode ? false : true,
        });
        this.add_child(buttonBox);

        this.app = params.app;
        this.number = params.number;
        this.currentWorkspace = params.currentWorkspace;

        let button = new MyAppButton(params);
        this.button = button;
        buttonBox.add_child(button);

        this._indicator = new Indicator.Indicator(params.indicator);
        this.add_child(this._indicator);
        this._indicator.show();

        this._stateChangedId = this.app.connect('windows-changed', () => {
            this._updateRunningStyle();
        });
        this._updateRunningStyle();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _updateRunningStyle() {
        let windows = this.app.get_windows();
        if (this.currentWorkspace) {
            windows = windows.filter( (window) => {
                return Util.windowInActiveWorkspace(window);
            });
        }
        this._indicator.value = windows.length;
    }

    _onDestroy() {
        if (this._stateChangedId > 0)
            this.app.disconnect(this._stateChangedId);
    }
});

const ControlsState = {
    HIDDEN: 0,
    WINDOW_PICKER: 1,
    APP_GRID: 2,
};

var ApplicationsButton = GObject.registerClass({
    Signals: {
        'activate-window': {},
    },
}, class ApplicationsButton extends St.Button {
    _init(iconSize) {
        super._init({ style_class: 'button-box',
                    track_hover: true,
                    can_focus: true,
        });

        this.icon = new St.Icon({ icon_name: 'view-app-grid-symbolic',
                                icon_size: iconSize,
                                style_class: 'show-apps-icon',
                                track_hover: true });
        this.set_child(this.icon);

        this.isApplicationButton = true;

        this.connect('clicked', this._clicked.bind(this));
    }

    _clicked() {
        Main.overview.show(ControlsState.APP_GRID);
        this.emit('activate-window');
    }
});
