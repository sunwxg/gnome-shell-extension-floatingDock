const { Gtk, Clutter, GObject, Shell, St } = imports.gi;

const PanelMenu = imports.ui.panelMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Extension = Me.imports.extension;
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;

function createNumberIcon(number, iconSize) {
        let icon = new St.Widget({
            style_class: 'number-window',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
            x_align:  Clutter.ActorAlign.START,
            y_align:  Clutter.ActorAlign.START
        });

        let labelBox = new St.BoxLayout({ vertical: true });

        let label = new St.Label({
            text: String.fromCharCode(Clutter.keysym_to_unicode(NUMBER_TO_CHAR[number])),
            x_align:  Clutter.ActorAlign.CENTER,
            y_align:  Clutter.ActorAlign.CENTER,
        });
        labelBox.add_child(label);

        icon.set_size(iconSize * 0.5, iconSize * 0.5);
        icon.add_child(labelBox);
        return icon;
}

var NumberIcon = GObject.registerClass(
class NumberIcon extends St.Widget {
//class NumberIcon extends PanelMenu.ButtonBox {
    _init(number, iconSize) {
        super._init({
            style_class: 'number-window',
            x_expand: true,
            y_expand: true,
            x_align:  Clutter.ActorAlign.START,
            y_align:  Clutter.ActorAlign.START,
        });
        let container = new St.Bin({
            layout_manager: new Clutter.BinLayout(),
            x_align:  Clutter.ActorAlign.CENTER,
            y_align:  Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });

        this.add_child(container);

        //this._minHPadding = this._natHPadding = 0.0;

        this._label = new St.Label({ y_expand: true,
            //style_class: 'number-label',
            text: String.fromCharCode(Clutter.keysym_to_unicode(NUMBER_TO_CHAR[number])),
            x_expand: true,
            x_align:  Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER });

        container.set_child(this._label);

        //print("wxg: prefer_height=", this.get_preferred_height(-1));
        //let child = this.get_first_child();
        //print("wxg: prefer_height=", child.get_height());
        this.set_size(iconSize * 0.5, iconSize * 0.5);
    }
});
