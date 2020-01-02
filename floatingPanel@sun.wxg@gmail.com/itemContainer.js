const { Clutter, GObject, Shell, St } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const AppDisplay = imports.ui.appDisplay;
const IconGrid = imports.ui.iconGrid;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;
const Util = Me.imports.util;
const WindowPreview = Me.imports.windowPreview;

var ICON_SIZE = 48;

var PanelAppIcon = GObject.registerClass({
}, class PanelAppIcon extends St.Widget {
    _init(app, vimMode, number) {
        super._init();

        this.app = app;

        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._icon.destroy_all_children();
        this.add_child(this._icon);

        //let gicon = app.app_info.get_icon();
        //let appicon = new St.Icon({ gicon: gicon,
                                    //icon_size: ICON_SIZE, });
        let appicon = this.app.create_icon_texture(ICON_SIZE);
        this._icon.add_child(appicon);

        if (vimMode)
            this._icon.add_child(this._createNumberIcon(number));
    }

    _createNumberIcon(number) {
        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   x_align:  Clutter.ActorAlign.START,
                                   y_align:  Clutter.ActorAlign.START });

        let box = new St.Widget();
        icon.add_child(box);

        let labelBox = new St.BoxLayout({ style_class: 'number-window',
                                          vertical: true });
        box.add_child(labelBox);

        let label = new St.Label({
            text: String.fromCharCode(Clutter.keysym_to_unicode(NUMBER_TO_CHAR[number])),
            x_align:  Clutter.ActorAlign.CENTER,
            y_align:  Clutter.ActorAlign.START,
        });
        labelBox.add_child(label);

        labelBox.set_size(ICON_SIZE * 0.5, ICON_SIZE * 0.5);
        box.set_size(ICON_SIZE * 0.5, ICON_SIZE * 0.5);
        return icon;
    }

    _createIcon(iconSize) {
        return this.app.create_icon_texture(iconSize);
    }
});

var MyAppButton = GObject.registerClass({
    Signals: {
        'activate-window': {},
    },
}, class MyAppButton extends St.Button {
    _init(app, vimMode, number) {
        super._init({ label: app.get_name(),
                      style_class: 'app-button',
                      y_align: Clutter.ActorAlign.CENTER,
        });

        this.set_child(new PanelAppIcon(app, vimMode, number));
        this.app = app;

        this._previewMenuManager = new PopupMenu.PopupMenuManager(this);
        this._previewMenu = null;

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = null;
    }

    vfunc_button_press_event(buttonEvent) {
        print("wxg: vfunc_button_press_event");
        super.vfunc_button_press_event(buttonEvent);
        if (buttonEvent.button == 3) {
            if (this._previewMenu.isOpen)
                return Clutter.EVENT_PROPAGATE;
            this._popupMenu();
                //this._previewMenu.close();
            return Clutter.EVENT_STOP;
        } else if (buttonEvent.button == 1) {
            this.leftButtonClicked();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    leftButtonClicked() {
        //let event = Clutter.get_current_event();
        //let modifiers = event ? event.get_state() : 0;
        //let isMiddleButton = this && this == Clutter.BUTTON_MIDDLE;
        //let isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) != 0;
        let openNewWindow = this.app.can_open_new_window() &&
                            !Util.appInActiveWorkspace(this.app);
                            //(this.app.state != Shell.AppState.RUNNING) &&
            //&& (isCtrlPressed || isMiddleButton);

        if (openNewWindow)
            this.app.open_new_window(-1);
        else {
            //this.app.activate();
            this._showPreviews();
        }
    }

    _showPreviews() {
        if (!this._previewMenu) {
            this._previewMenu = new WindowPreview.WindowPreviewMenu(this);

            this._previewMenuManager.addMenu(this._previewMenu, St.Side.LEFT);

            //this._previewMenu.connect('open-state-changed', (menu, isPoppedUp) => {
                //if (!isPoppedUp)
                    //this._onMenuPoppedDown();
            //});
            //let id = Main.overview.connect('hiding', () => {
                //this._previewMenu.close();
            //});
            //this._previewMenu.actor.connect('destroy', function() {
                //Main.overview.disconnect(id);
            //});
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
            this._menu = new AppDisplay.AppIconMenu(this);
            this._menu.connect('activate-window', (menu, window) => {
                this.activateWindow(window);
            });
            //this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
                //if (!isPoppedUp)
                    //this._onMenuPoppedDown();
            //});
            //let id = Main.overview.connect('hiding', () => {
                //this._menu.close();
            //});
            //this.connect('destroy', () => {
                //Main.overview.disconnect(id);
            //});

            this._menuManager.addMenu(this._menu);
        }

        this._menu.popup();
        this._menuManager.ignoreRelease();

        return false;
    }

    activateWindow(metaWindow) {
        if (metaWindow)
            Main.activateWindow(metaWindow);
        //else
            //Main.overview.hide();

        this.emit('activate-window');
    }

    animateLaunch() {
        //this.icon.animateZoomOut();
    }
});

var ItemContainer = GObject.registerClass(
class ItemContainer extends St.Widget {
    _init(app, vimMode, number) {
        super._init({ style_class: 'item-container',
                      layout_manager: new Clutter.BinLayout(),
                      x_expand: true,
                      y_expand: true,
                      reactive: true,
                      track_hover: true,
        });

        this.app = app;
        this.number = number;

        let button = new MyAppButton(app, vimMode, number);

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
