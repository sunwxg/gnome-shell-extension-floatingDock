const { Clutter, GObject, St } = imports.gi;

var Dash = GObject.registerClass(
class Dash extends St.Widget {
    _init() {
        super._init({ style_class: 'app-running-dash',
                      x_expand: true,
                      y_expand: true,
                      x_align: Clutter.ActorAlign.CENTER,
                      y_align: Clutter.ActorAlign.END,
        });

        this._value = 0;
    }

    set value(value) {
        this._value = value > 4 ? 4 : value;
        if (this._value > 0)
            this.show();
        else
            this.hide();
    }
});

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
        let x = size / 2;
        let y = 0;

        let step = this._size / (this._value + 1)
        for (let i = 1; i <= this._value; i++) {
            cr.arc(x, y + step * i, radius, 0, 2 * Math.PI);
            cr.fillPreserve();
            cr.stroke();
        }
    }
});
