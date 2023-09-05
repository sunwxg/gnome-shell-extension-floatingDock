import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';

import * as Indicator from './indicator.js';
import * as Util from './util.js';
import * as WindowPreview from './windowPreview.js';
import {NUMBER_TO_CHAR} from './util.js';
import {CreateNumberIcon} from './numberIcon.js';

const MyAppIcon = GObject.registerClass({
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
            this._icon.add_child(CreateNumberIcon(params.number, this.iconSize, params.dir));
    }
});

const MyAppButton = GObject.registerClass({
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
            dir: params.dir,
        }));
        this.app = params.app;
        this.iconSize = params.iconSize;
        this.vimMode = params.vimMode;
        this.currentWorkspace = params.currentWorkspace;
        this.dir = params.dir;
        this.settings = params.settings;
        this.time = 0;

        this.set_pivot_point(0.5, 0.5);
        this.connect('notify::hover', this._onHover.bind(this));

        this._previewMenuManager = new PopupMenu.PopupMenuManager(this);
        this._previewMenu = null;

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = null;
    }

    vfunc_button_press_event(buttonEvent) {
        const ret = super.vfunc_button_press_event(buttonEvent);
        if (buttonEvent.get_button() == 3) {
            if (this._previewMenu && this._previewMenu.isOpen)
                return ret;

            this._popupMenu();
        }
        return ret;
    }

    vfunc_clicked(button) {
        this.leftButtonClicked();
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
            this._previewMenu = new WindowPreview.WindowPreviewMenu(this, this.iconSize, this.dir, this.settings);
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
            this._menu = new AppMenu(this, St.Side.LEFT, {
                favoritesSection: true,
                showSingleWindows: true,
            });
            this._menu.setApp(this.app);
            this._menu.connect('activate-window', (menu, window) => {
                this.activateWindow(window); });
            this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
                if (!isPoppedUp)
                    this.emit('activate-window');
            });

            Main.uiGroup.add_actor(this._menu.actor);
            this._menuManager.addMenu(this._menu);
        }

        this._menu.open(BoxPointer.PopupAnimation.FULL);
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

export const ItemContainer = GObject.registerClass(
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

export const ApplicationsButton = GObject.registerClass({
    Signals: {
        'activate-window': {},
    },
}, class ApplicationsButton extends St.Button {
    _init(iconSize, vimMode) {
        super._init({ style_class: 'button-box',
                    track_hover: true,
                    can_focus: true,
                    reactive: vimMode ? false : true,
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
