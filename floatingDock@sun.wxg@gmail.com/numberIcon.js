import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gtk from 'gi://Gtk';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {NUMBER_TO_CHAR} from './util.js';

export function CreateNumberIcon(number, iconSize, dir) {
        let icon = new St.Widget({
            name: 'floating-dock-number-icon',
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
        let uri = dir.get_path() + '/icons/'+ word + '.png';
        if (!GLib.file_test(uri, GLib.FileTest.EXISTS))
            return icon;

        let gicon = new Gio.FileIcon({ file: Gio.File.new_for_path(uri) });
        let numberIcon = new St.Icon({ gicon: gicon,
                                       icon_size: iconSize * 0.4 });
        icon.add_child(numberIcon);

        return icon;
}
