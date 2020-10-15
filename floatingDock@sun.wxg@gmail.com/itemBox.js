const { Clutter, GObject, St } = imports.gi;

var ItemBox = GObject.registerClass(
class ItemBox extends St.Widget {
    _init(direction) {
        super._init({ style_class: 'item-box',
                      clip_to_allocation: true,
        });

        this.layout_manager = new BoxSlideLayout(this, direction);
    }

    setSlide(value) {
        this.layout_manager.slide = value;
    }
});

var BoxSlideLayout = GObject.registerClass({
    Properties: {
        'slide': GObject.ParamSpec.double(
            'slide', 'slide', 'slide',
            GObject.ParamFlags.READWRITE,
            0, 1, 1),
    }
}, class BoxSlideLayout extends Clutter.FixedLayout {
    _init(actor, direction, params) {
        this._slide = 0;
        this._direction = direction;

        super._init(params);
    }

    vfunc_get_preferred_width(container, forHeight) {
        let child = container.get_first_child();
        if (child == null)
            return [null, null];

        let [minWidth, natWidth] = child.get_preferred_width(forHeight);
        if (this._direction == St.Side.TOP ||
            this._direction == St.Side.BOTTOM)
            return [minWidth, natWidth];

        let children = container.get_children();
        minWidth = minWidth * this._slide * children.length;
        natWidth = natWidth * this._slide * children.length;

        return [minWidth, natWidth];
    }

    vfunc_get_preferred_height(container, forWidth) {
        let child = container.get_first_child();
        if (child == null)
            return [null, null];

        let [minHeight, natHeight] = child.get_preferred_height(forWidth);
        if (this._direction == St.Side.LEFT ||
            this._direction == St.Side.RIGHT)
            return [minHeight, natHeight];

        let children = container.get_children();
        minHeight = minHeight * this._slide * children.length;
        natHeight = natHeight * this._slide * children.length;

        return [minHeight, natHeight];
    }

    vfunc_allocate(container, box) {
        let children = container.get_children();
        if (!children.length)
            return;

        let availWidth = Math.round(box.x2 - box.x1);
        let availHeight = Math.round(box.y2 - box.y1);

        let child = container.get_first_child();
        let [, natWidth] = child.get_preferred_width(availHeight);
        let [, natHeight] = child.get_preferred_height(availWidth);

        let actorBox = new Clutter.ActorBox();
        for (let i = 0; i < children.length; i++) {
            if (this._direction == St.Side.TOP ||
                this._direction == St.Side.BOTTOM) {
                actorBox.x1 = box.x1;
                actorBox.x2 = actorBox.x1 + (child.x_expand ? availWidth : natWidth);
                actorBox.y1 = box.y1 + i * natHeight;
                actorBox.y2 = actorBox.y1 + natHeight;

                if (actorBox.y2 > box.y2)
                break;

                children[i].allocate(actorBox);
            } else {
                actorBox.x1 = box.x1 + i * natWidth;
                actorBox.x2 = actorBox.x1 + natWidth;
                actorBox.y1 = box.y1 ;
                actorBox.y2 = actorBox.y1 + (child.x_expand ? availHeight : natHeight);

                if (actorBox.x2 > box.x2)
                break;

                children[i].allocate(actorBox);
            }
        }
    }

    set slide(value) {
        if (this._slide == value)
            return;
        this._slide = value;
        this.layout_changed();
    }

    get slide() {
        return this._slide;
    }
});
