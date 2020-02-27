const { Clutter, Gio, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;
const Params = imports.misc.params;
const GrabHelper = imports.ui.grabHelper;
const SystemActions = imports.misc.systemActions;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const SCHEMA = 'org.gnome.shell.extensions.floatingDock';
const APP_LIST = 'floating-dock-app-list';
const DIRECTION_ID = 'floating-dock-direction';

const SYSTEM_ACTIONS = ['lock-screen', 'logout', 'suspend', 'power-off'];

const DIRECTION = ['up', 'down', 'right', 'left'];

const ITEM_ANIMATION_TIME = 200;

var AroundButtonManager = GObject.registerClass(
class AroundButtonManager extends St.Widget {
    _init(iconSize, mainButton) {
        super._init({});

        this._gsettings = ExtensionUtils.getSettings(SCHEMA);

        this.iconSize = iconSize;
        this._mainButton = mainButton;
        this._grabHelper = new GrabHelper.GrabHelper(this, { actionMode: Shell.ActionMode.POPUP });
        this.showAroundButton = false;

        this._aroundButtons = [];
        for (let i = 0; i < SYSTEM_ACTIONS.length; i++) {
            this._aroundButtons[i] = this.createButton(SYSTEM_ACTIONS[i], i);
        }
        for (let i = 0; i < DIRECTION.length; i++) {
            this._aroundButtons[i + DIRECTION.length] = 
                this.createButton(DIRECTION[i], i + DIRECTION.length);
            if ((i + SYSTEM_ACTIONS.length) == 7)
                break;
        }
        //this._userApps = (this._gsettings.get_string(APP_LIST)).split(';');
        //for (let i = 0; i < this._userApps.length; i++) {
            //this._aroundButtons[i + SYSTEM_ACTIONS.length] =
                //this.createButton(this._userApps[i], i + SYSTEM_ACTIONS.length);
            //if ((i + SYSTEM_ACTIONS.length) == 7)
                //break;
        //}

        this._mainButtonHideId = this._mainButton.connect('hide', () => this.popupClose() );
    }

    createButton(id, number) {
        let button = new AroundButton(id, number, this.iconSize, this._mainButton);

        Main.layoutManager.addChrome(button);
        button.hide();

        this._grabHelper.addActor(button);
        button.connect('animation-complete', this.grabFocus.bind(this));
        button.connect('button-clicked', this.popupClose.bind(this));
        button.connect('direction-changed', this.directionChanged.bind(this));
        return button;
    }

    popup() {
        this.showAroundButton = !this.showAroundButton;
        if (this.showAroundButton)
            this.showButton(true);
        else
            this.hideButton(true);
    }

    popupClose() {
        this.showAroundButton = false;
        this.hideButton(false);
        this._grabHelper.ungrab({ actor: this._grabButton });
    }

    directionChanged(button, direction) {
        this.popupClose();
        this._gsettings.set_string(DIRECTION_ID, direction);
    }

    grabFocus(button, number) {
        if (number != this._aroundButtons.length - 1)
            return;

        this._grabButton = button;
        this._grabHelper.grab({
            actor: button,
            focus: button,
            onUngrab: () => this.hideButton(true),
        });
    }

    showButton(animation) {
        if (animation)
            this._aroundButtons.forEach( button => { button.showAnimation(); });
        else
            this._aroundButtons.forEach( button => { button.show(); });
    }

    hideButton(animation) {
        if (animation)
            this._aroundButtons.forEach( button => { button.hideAnimation(); });
        else
            this._aroundButtons.forEach( button => { button.hide(); });
        this.showAroundButton = false;
    }

    destroy() {
        if (this._mainButtonHideId)
            this._mainButton.disconnect(this._mainButtonHideId);

        this._aroundButtons.forEach( button => {
            this._grabHelper.removeActor(button);
            Main.layoutManager.removeChrome(button);
            button.destroy();
        });

        super.destroy();
    }
});

var AroundButton = GObject.registerClass({
    Signals: {
        'animation-complete': { param_types: [GObject.TYPE_INT] },
        'button-clicked': {},
        'direction-changed': { param_types: [GObject.TYPE_STRING] },
    },
}, class AroundButton extends St.Button {
    _init(id, number, iconSize, mainButton) {
        super._init({ name: 'floating-dock-around-button',
                      y_align: Clutter.ActorAlign.CENTER,
                      reactive: true,
                      track_hover: true,
        });

        this.id = id;
        let appSys = Shell.AppSystem.get_default();
        this.isApp = appSys.lookup_app(id) ? true : false;
        this.isAction = SYSTEM_ACTIONS.includes(id) ? true : false;

        this.number = number;
        this.iconSize = iconSize;
        this.mainButton = mainButton;
        this.set_pivot_point(0.5, 0.5);
        this.scale = 0.8;

        this._systemActions = new SystemActions.getDefault();

        if (this.isApp) {
            let app = appSys.lookup_app(this.id);
            this.set_child(app.create_icon_texture(this.iconSize));
        } else if (this.isAction) {
            let iconName = this._systemActions.getIconName(id);
            let icon = new St.Icon({ icon_name: iconName,
                                     width: this.iconSize,
                                     height: this.iconSize,
                                     style_class: 'system-action-icon' });
            this.set_child(icon);
        } else {
            let uri = Me.path + '/icons/' + this.id + '.png';
            let gicon = new Gio.FileIcon({ file: Gio.File.new_for_path(uri) });
            let icon = new St.Icon({ gicon: gicon,
                                     icon_size: this.iconSize });
            this.set_child(icon);
        }

        this.connect('clicked', this._onClicked.bind(this));
        this.connect('notify::hover', this._onHover.bind(this));
    }

    /*
     *       1
     *    0      2
     *   7  Main  3
     *    6      4
     *       5
     */
    _circle(box) {
        let boxWidth = box.x2 - box.x1;
        let boxHeight = box.y2 - box.y1;
        let R = this.iconSize * 1.2;

        let x, y;
        if (this.number == 0) {
            x = box.x1 - R * 0.7071;
            y = box.y1 - R * 0.7071;
        } else if (this.number == 1) {
            x = box.x1;
            y = box.y1 - R;
        } else if (this.number == 2) {
            x = box.x1 + R * 0.7071;
            y = box.y1 - R * 0.7071;
        } else if (this.number == 7) {
            x = box.x1 - R;
            y = box.y1;
        } else if (this.number == 3) {
            x = box.x1 + R;
            y = box.y1;
        } else if (this.number == 6) {
            x = box.x1 - R * 0.7071;
            y = box.y1 + R * 0.7071;
        } else if (this.number == 5) {
            x = box.x1;
            y = box.y1 + R;
        } else if (this.number == 4) {
            x = box.x1 + R * 0.7071;
            y = box.y1 + R * 0.7071;
        }

        return [x, y];
    }

    /*
     *  +----+----+----+
     *  | 0  | 1  | 2  |
     *  +----+----+----+
     *  | 3  |Main| 4  |
     *  +----+----+----+
     *  | 5  | 6  | 7  |
     *  +----+----+----+
     */
    _square(box) {
        let boxWidth = box.x2 - box.x1;
        let boxHeight = box.y2 - box.y1;

        let x, y;
        if (this.number == 0) {
            x = box.x1 - boxWidth;
            y = box.y1 - boxHeight;
        } else if (this.number == 1) {
            x = box.x1;
            y = box.y1 - boxHeight;
        } else if (this.number == 2) {
            x = box.x1 + boxWidth;
            y = box.y1 - boxHeight;
        } else if (this.number == 3) {
            x = box.x1 - boxWidth;
            y = box.y1;
        } else if (this.number == 4) {
            x = box.x1 + boxWidth;
            y = box.y1;
        } else if (this.number == 5) {
            x = box.x1 - boxWidth;
            y = box.y1 + boxHeight;
        } else if (this.number == 6) {
            x = box.x1;
            y = box.y1 + boxHeight;
        } else if (this.number == 7) {
            x = box.x1 + boxWidth;
            y = box.y1 + boxHeight;
        }

        return [x, y];
    }

    showAnimation() {
        let box = this.mainButton.get_allocation_box();
        let boxWidth = box.x2 - box.x1;
        let boxHeight = box.y2 - box.y1;

        this.show();
        this.set_position(box.x1, box.y1);

        //let [x, y] = this._square(box);
        let [x, y] = this._circle(box);
        this.scale = 0;
        this.ease({
            x: x,
            y: y,
            scale_x: 0.8,
            scale_y: 0.8,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: ITEM_ANIMATION_TIME,
            onComplete: () => {
                    this.emit('animation-complete', this.number); }
            });
    }

    hideAnimation() {
        let box = this.mainButton.get_allocation_box();

        this.scale = 1;
        this.ease({
            x: box.x1,
            y: box.y1,
            scale_x: 0,
            scale_y: 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: ITEM_ANIMATION_TIME,
            onComplete: () => this.hide() });
    }

    _onClicked() {
        if (this.isApp) {
            let app = appSys.lookup_app(this.id);
            app.open_new_window(-1);
        } else if (this.isAction) {
            this._systemActions.activateAction(this.id);
        } else {
            this.emit('direction-changed', this.id);
            return;
        }

        this.emit('button-clicked');
    }

    _onHover() {
        let scale;
        if (this.hover) {
            scale = 1;
        } else {
            scale = 0.8;
        }

        this.ease({
            scale_x: scale,
            scale_y: scale,
        });
    }
});
