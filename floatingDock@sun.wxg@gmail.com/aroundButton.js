const { Clutter, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;
const Params = imports.misc.params;
const GrabHelper = imports.ui.grabHelper;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ITEM_ANIMATION_TIME = 200;

var AroundButtonManager = GObject.registerClass(
class AroundButtonManager extends St.Widget {
    _init(iconSize, mainButton) {
        super._init({});

        this.iconSize = iconSize;
        this._mainButton = mainButton;
        this._grabHelper = new GrabHelper.GrabHelper(this, { actionMode: Shell.ActionMode.POPUP });
        this.showAroundButton = false;

        let id = 'gnome-control-center.desktop';
        let appSys = Shell.AppSystem.get_default();
        let app = appSys.lookup_app(id);

        this._aroundButtons = [];
        for (let i = 0; i <= 7; i++) {
            let button = new AroundButton(app, i, this.iconSize, this._mainButton);
            Main.layoutManager.addChrome(button, { trackFullscreen: true });
            this._grabHelper.addActor(button);
            button.connect('animation-complete', this.grabFocus.bind(this));
            button.connect('button-clicked', () => this.popupClose());
            button.hide();
            this._aroundButtons[i] = button;
        }
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

    grabFocus(button) {
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
        'animation-complete': {},
        'button-clicked': {},
    },
}, class AroundButton extends St.Button {
    _init(app, number, iconSize, mainButton) {
        super._init({ label: app.get_name(),
                      name: 'floating-dock-around-button',
                      y_align: Clutter.ActorAlign.CENTER,
                      reactive: true,
                      track_hover: true,
        });

        this.app = app;
        this.number = number;
        this.iconSize = iconSize;
        this.mainButton = mainButton;
        this.set_pivot_point(0.5, 0.5);
        this.scale = 0.8;

        this.set_child(this.app.create_icon_texture(this.iconSize));

        this.connect('clicked', this._onClicked.bind(this));
        this.connect('notify::hover', this._onHover.bind(this));
    }

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
        } else if (this.number == 3) {
            x = box.x1 - R;
            y = box.y1;
        } else if (this.number == 4) {
            x = box.x1 + R;
            y = box.y1;
        } else if (this.number == 5) {
            x = box.x1 - R * 0.7071;
            y = box.y1 + R * 0.7071;
        } else if (this.number == 6) {
            x = box.x1;
            y = box.y1 + R;
        } else if (this.number == 7) {
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
                if (this.number == 7)
                    this.emit('animation-complete'); }
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
        this.app.open_new_window(-1);
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
