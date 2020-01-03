const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const SCHEMA = 'org.gnome.shell.extensions.floatingPanel';
const HOTKEY = 'floating-panel-hotkey';
const DIRECTION = 'floating-panel-direction';
const ICON_SIZE = 'floating-panel-icon-size';

const DIRECTION_LIST = {
    "up": "up",
    "down": "down",
    "right": "right",
    "left": "left",
};

const ICON_SIZE_LIST = {
    128 : '128',
    96  : '96',
    64  : '64',
    48  : '48',
    32  : '32',
    24  : '24',
    16  : '16',
};

function init() {
    //Convenience.initTranslations();
}

function buildPrefsWidget() {
    let frame = new Frame();
    frame.widget.show_all();

    return frame.widget;
}

var Frame = class Frame {
    constructor() {
        this._settings = Convenience.getSettings(SCHEMA);

        this._builder = new Gtk.Builder();
        this._builder.add_from_file(Me.path + '/prefs.ui');

        this.widget = this._builder.get_object('settings_notebook');

        let settings_box = this._builder.get_object('settings_box');

        //settings_box.add(this.addItemSwitch("<b>Icon list direction</b>", DIRECTION));
        settings_box.add(this.addDirectionCombo());
        settings_box.add(this.addIconSizeCombo());
    }

    addDirectionCombo() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 margin_top: 10,
                                 margin_left: 20,
                                 margin_right: 20,
        });
        let setting_label = new Gtk.Label({  xalign: 0 });
        setting_label.set_markup("<b>Icon list direction</b>");
        hbox.pack_start(setting_label, true, true, 0);
        hbox.add(this.directionCombo());

        return hbox;
    }

    directionCombo() {
        let combo = new Gtk.ComboBoxText();
        combo.set_entry_text_column(0);

        for (let l in DIRECTION_LIST) {
            combo.append(l, DIRECTION_LIST[l]);
        }
        combo.set_active_id(this._settings.get_string(DIRECTION));

        combo.connect('changed', () => {
            this._settings.set_string(DIRECTION, combo.get_active_id());
        });

        return combo;
    }

    addIconSizeCombo() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 margin_top: 10,
                                 margin_left: 20,
                                 margin_right: 20,
        });
        let setting_label = new Gtk.Label({  xalign: 0 });
        setting_label.set_markup("<b>Icon Size</b>");
        hbox.pack_start(setting_label, true, true, 0);
        hbox.add(this.iconSizeCombo());

        return hbox;
    }

    iconSizeCombo() {
        let combo = new Gtk.ComboBoxText();
        combo.set_entry_text_column(0);

        for (let l in ICON_SIZE_LIST) {
            combo.append(l, ICON_SIZE_LIST[l]);
        }
        combo.set_active_id(this._settings.get_int(ICON_SIZE).toString());

        combo.connect('changed', () => {
            this._settings.set_int(ICON_SIZE, combo.get_active_id());
        });

        return combo;
    }

    addItemSwitch(string, key) {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 20});
        let info = new Gtk.Label({xalign: 0});
        info.set_markup(string);
        hbox.pack_start(info, false, false, 0);

        let button = new Gtk.Switch({ active: gsettings.get_boolean(key) });
        button.connect('notify::active', (button) => { gsettings.set_boolean(key, button.active); });
        hbox.pack_end(button, false, false, 0);
        return hbox;
    }
};
