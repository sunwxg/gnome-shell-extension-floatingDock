const { Clutter, GObject, Shell, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var ITEM_ANIMATION_TIME = 200;

var AroundButton = GObject.registerClass({
    Signals: {
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

        this.set_child(this.app.create_icon_texture(this.iconSize));
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

    showAnimation() {
        let box = this.mainButton.get_allocation_box();
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

        this.show();
        this.set_position(box.x1, box.y1);

        this.scale = 0;
        this.ease({
            x: x,
            y: y,
            scale_x: 1,
            scale_y: 1,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: ITEM_ANIMATION_TIME, });
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

    xxxx_vfunc_allocate(box, flags) {
        super.vfunc_allocate(box,flags);

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

        box.set_origin(x, y);
        this.set_allocation(box, flags);
    }
});
