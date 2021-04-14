const { Clutter, GObject, St } = imports.gi;

var Indicator = GObject.registerClass(
class Indicator extends St.Widget {
    _init(indicator) {
        super._init({
                      x_expand: true,
                      y_expand: true,
        });

        this._type = indicator[0];
        this._position = indicator[1];
        this._value = 0;
    }

    set value(value) {
        this.destroy_all_children();
        this._value = value > 4 ? 4 : value;
        for (let i = 1; i <= this._value; i++) {
            let dot;
            if (this._type == 'dash')
                dot = new St.Widget({ style_class: 'app-running-dash',
                    x_expand: true,
                    y_expand: true, });
            else
                dot = new St.Widget({ style_class: 'app-running-dot',
                    x_expand: true,
                    y_expand: true, });

            this.add_child(dot);
        }
    }

    vfunc_allocate(box) {
        super.vfunc_allocate(box);

        let children = this.get_children();
        if (children.length == 0)
            return;

        let contentBox = this.get_theme_node().get_content_box(box);

        let availWidth = (contentBox.x2 - contentBox.x1);
        let availHeight = (contentBox.y2 - contentBox.y1);

        let actorBox = new Clutter.ActorBox();
        let step = availWidth / (children.length + 1);
        for (let i = 0; i < children.length; i++) {
            let [, natWidth] = children[i].get_preferred_width(availHeight);
            let [, natHeight] = children[i].get_preferred_height(availWidth);

            if (this._position == 'bottom') {
                actorBox.x1 = contentBox.x1 + step * (i + 1) - (natWidth / 2);
                actorBox.x2 = actorBox.x1 + natWidth;
                actorBox.y1 = contentBox.y1 + availHeight - natHeight;
                actorBox.y2 = actorBox.y1 + natHeight;
            } else {
                actorBox.x1 = contentBox.x1;
                actorBox.x2 = actorBox.x1 + natWidth;
                actorBox.y1 = contentBox.y1 + step * (i + 1) - (natHeight / 2);
                actorBox.y2 = actorBox.y1 + natHeight;
            }
            children[i].allocate(actorBox);
        }
    }
});

/*
var Dot = GObject.registerClass({
}, class Dot extends St.DrawingArea {
    _init(iconSize) {
        super._init({ style_class: 'app-running-dot',
                      x_expand: true,
                      y_expand: true,
                      y_align: Clutter.ActorAlign.CENTER,
        });

        this._value = 0;
        this._size = iconSize;
        this.set_size(iconSize, iconSize);

    }

    set value(value) {
        this._value = value > 4 ? 4 : value;
        this.queue_repaint();
    }

    vfunc_repaint() {
        if (!this._value)
            return;

        let cr = this.get_context();
        let themeNode = this.get_theme_node();
        let color = themeNode.get_foreground_color();
        Clutter.cairo_set_source_color(cr, color);

        let size = this._size * 0.15;
        let radius = size / 2 - 1;
        //let x = size / 2;
        //let y = 0;
        let x = 1;
        //let y = this._size - radius ;
        let y = this._size;

        let step = this._size / (this._value + 1)
        //let step = this._size / (this._value + 1)
        //for (let i = 1; i <= this._value; i++) {
            //cr.arc(x, y + step * i, radius, 0, 2 * Math.PI);
            //cr.fillPreserve();
            //cr.stroke();
        //}
        for (let i = 1; i <= this._value; i++) {
            cr.arc(x + step * i, y, radius, 0, 2 * Math.PI);
            cr.fillPreserve();
            cr.stroke();
        }
    }
});
*/
