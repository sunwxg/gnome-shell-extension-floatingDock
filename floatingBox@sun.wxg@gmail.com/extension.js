// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const { Atk, Clutter, GLib, Gio, Gtk, Gdk, GObject, Meta, Shell, St } = imports.gi;
const Mainloop = imports.mainloop;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Tweener = imports.ui.tweener;
const PanelMenu = imports.ui.panelMenu;
const DND = imports.ui.dnd;
const AppFavorites = imports.ui.appFavorites;
const Dash = imports.ui.dash;
const Conf = imports.misc.config;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const DICT_SCHEMA = 'org.gnome.shell.extensions.dict';

var DEFAULT_BACKGROUND_COLOR = Clutter.Color.from_pixel(0x2e3436ff);

var WINDOW_DND_SIZE = 256;
var DRAGGING_WINDOW_OPACITY = 100;

var DragDropResult = {
    FAILURE:  0,
    SUCCESS:  1,
    CONTINUE: 2,
};

class FloatBox {
    constructor() {
        let panelBox = new PanelBox();
    }
}

var PanelBox = GObject.registerClass({
    Signals: {
        'size-changed': {},
    },
}, class PanelBox extends St.BoxLayout {
    _init() {
        super._init({ //name: 'panelbox',
                      style_class: 'panel-box',
                      vertical: true,
                      x_align: Clutter.ActorAlign.CENTER });

        //this._container = new DashContainer();
        //this.set_child(this._container);

        //this._container.add_actor(this._mainButton());
        this._mainButton = this._getMainButton();
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
        this.add_child(this._mainButton)

        let [x, y] =global.get_pointer();
        this._x = x;
        this._y = y;
        this._showApp = false;

        this._box = new St.BoxLayout ({ vertical: true });
        this.add_child(this._box);

        this._workId = Main.initializeDeferredWork(this, this._redisplay.bind(this));

        this._appSystem = Shell.AppSystem.get_default();

        this._appSystem.connect('installed-changed', () => {
            AppFavorites.getAppFavorites().reload();
            this._queueRedisplay();
        });
        AppFavorites.getAppFavorites().connect('changed', this._queueRedisplay.bind(this));
        this._appSystem.connect('app-state-changed', this._queueRedisplay.bind(this));

        //Main.uiGroup.add_child(this);
        Main.layoutManager.addChrome(this, { trackFullscreen: true });
    }

    _getMainButton() {
        let gicon = new Gio.FileIcon({
                    file: Gio.File.new_for_path(Me.path + '/icons/flag.png') });
        let icon = new St.Icon({ gicon: gicon,
                                 icon_size: 48 });

        let button= new St.Button({ style_class: 'main-button',
                                    //background_color: DEFAULT_BACKGROUND_COLOR,
                                    child: icon });

        return button;
    }

    _getDragButton() {
        let gicon = new Gio.FileIcon({
                    file: Gio.File.new_for_path(Me.path + '/icons/flag.png') });
        let icon = new St.Icon({ gicon: gicon,
                                 icon_size: 48 });

        let button= new St.Button({ style_class: 'item-container',
                                    child: icon });

        return button;
    }

    _redisplay() {
        print("wxg: _redisplay");

        let children = this._box.get_children();
        children.map(actor => { actor.destroy(); });

        children = this._getFavorites(children);

        this._addApps(children);

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

        for (let i = 0; i < running.length; i++) {
            if (this._findInBox(running[i]))
                continue;

            let item = new ItemContainer(running[i]);
            item.child.connect('clicked', this._appButtonClicked.bind(this));
            item.child.connect('popup-menu', this._popupMenu.bind(this));
            item.child.connect('key-press-event', this._popupMenu.bind(this));

            this._box.add_child(item);
        }
    }

    _getFavorites(children) {
        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        for (let i in favorites) {
            let item = new ItemContainer(favorites[i]);
            item.child.connect('clicked', this._appButtonClicked.bind(this));
            item.child.connect('popup-menu', this._popupMenu.bind(this));
            item.child.connect('key-press-event', this._popupMenu.bind(this));

            this._box.add_child(item);
        }

        return children;
    }

    _popupMenu(button) {
        print("wxg: popup menu");
    }

    _appButtonClicked(button) {
        let event = Clutter.get_current_event();
        let modifiers = event ? event.get_state() : 0;
        let isMiddleButton = button && button == Clutter.BUTTON_MIDDLE;
        let isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) != 0;
        let openNewWindow = button.app.can_open_new_window() &&
                            button.app.state == Shell.AppState.RUNNING &&
                            (isCtrlPressed || isMiddleButton);

        if (openNewWindow)
            button.app.open_new_window(-1);
        else
            button.app.activate();

        this._showApp = false;
        this._box.hide();
    }

    _mainButtonClicked() {
        this._showApp = !this._showApp;
        if (this._showApp)
            this._box.show();
        else
            this._box.hide();
    }

    _showPanel(x, y) {
        this._x = x;
        this._y = y;

        this.set_position(x, y);

        if (this._showApp)
            this._box.show();
        else
            this._box.hide();

        this.show();
    }


    _queueRedisplay() {
        Main.queueDeferredWork(this._workId);
    }

    _onDragMotion(dropEvent) {
        this._showPanel(dropEvent.dragActor.x, dropEvent.dragActor.y);
        return DND.DragMotionResult.CONTINUE;
    }

    _onDragBegin(_draggable, _time) {
        print("wxg: _onDragBegin");
        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this),
        };
        DND.addDragMonitor(this._dragMonitor);
    }

    _onDragCancelled(_draggable, _time) {
        print("wxg: _onDragCancelled");
    }

    _onDragEnd(_draggable, _time, _snapback) {
        print("wxg: _onDragEnd");
        DND.removeDragMonitor(this._dragMonitor);
    }

    getDragActor() {
        return this._getDragButton();
    }

    getDragActorSource() {
        return this._mainButton;
    }

    destroy() {
        Main.layoutManager.removeChrome(this);
    }
});

var ItemContainer = GObject.registerClass(
class ItemContainer extends St.BoxLayout {
    _init(app) {
        super._init({ style_class: 'item-container',
                      vertical: true,
                      reactive: true,
                      track_hover: true,
                      x_align: Clutter.ActorAlign.CENTER,
        });

        this.app = app;

        let button = new St.Button({ label: app.get_name(),
                                     y_align: Clutter.ActorAlign.CENTER,
                                     x_align: Clutter.ActorAlign.CENTER });
        let gicon = app.app_info.get_icon();
        let icon = new St.Icon({ gicon: gicon,
                                 icon_size: 48, });
        button.set_child(icon);
        button.app = app;

        this.add_child(button);
        this.child = button;

        this._dot = new St.Widget({ name: 'app-running-dot',
                                    //style_class: 'app-running-dot',
                                    layout_manager: new Clutter.BinLayout(),
                                    x_expand: true,
                                    y_expand: true,
                                    x_align: Clutter.ActorAlign.CENTER,
                                    y_align: Clutter.ActorAlign.END,
                                    width: 10,
                                    height: 2,
                                    margin_bottom: 6,
        });
        this.add_child(this._dot);

        this._stateChangedId = this.app.connect('notify::state', () => {
            this._updateRunningStyle();
        });
        this._updateRunningStyle();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _updateRunningStyle() {
        if (this.app.state != Shell.AppState.STOPPED)
            this._dot.show();
        else
            this._dot.hide();
    }

    _onDestroy() {
        if (this._stateChangedId > 0)
            this.app.disconnect(this._stateChangedId);
    }
});

let floatBox;

function init(metadata) {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(metadata.path + '/icons');
}

function enable() {
    floatBox = new FloatBox();
}

function disable() {
    floatBox.destroy();
    floatBox = null;
}
