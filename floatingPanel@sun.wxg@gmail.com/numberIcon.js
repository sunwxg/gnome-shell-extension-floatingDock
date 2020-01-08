const { GLib, Gio, Gtk, Clutter, GObject, Shell, St } = imports.gi;

const PanelMenu = imports.ui.panelMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Extension = Me.imports.extension;
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;

function createNumberIcon(number, iconSize) {
        let icon = new St.Widget({
            //style_class: 'number-icon',
            name: 'number-icon',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
            x_align:  Clutter.ActorAlign.START,
            y_align:  Clutter.ActorAlign.START
        });
        //let labelBox = new St.BoxLayout({ vertical: true });

        //let label = new St.Label({
            //text: String.fromCharCode(Clutter.keysym_to_unicode(NUMBER_TO_CHAR[number])),
            //x_align:  Clutter.ActorAlign.CENTER,
            //y_align:  Clutter.ActorAlign.CENTER,
        //});
        //labelBox.add_child(label);

        let word = String.fromCharCode(Clutter.keysym_to_unicode(NUMBER_TO_CHAR[number]));
        let uri = Me.path + '/icons/'+ word + '.png';
        if (!GLib.file_test(uri, GLib.FileTest.EXISTS))
            return icon;

        let gicon = new Gio.FileIcon({ file: Gio.File.new_for_path(uri) });
        let numberIcon = new St.Icon({ gicon: gicon,
                                       icon_size: iconSize * 0.4 });
        icon.add_child(numberIcon);

        return icon;
}
