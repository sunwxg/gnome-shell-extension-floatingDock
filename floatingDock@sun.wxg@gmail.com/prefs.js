const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const SCHEMA = 'org.gnome.shell.extensions.floatingDock';
const HOTKEY = 'floating-dock-hotkey';
const DIRECTION = 'floating-dock-direction';
const ICON_SIZE = 'floating-dock-icon-size';
const ICON_FILE = 'floating-dock-icon-file';
const APP_LIST = 'floating-dock-app-list';
const USE_FAVORITES = 'floating-dock-icon-favorites';
const KEEP_OPEN = 'floating-dock-keep-open';
const INDICATOR = 'floating-dock-indicator';

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
}

function buildPrefsWidget() {
    let frame = new Frame();
    frame.widget.show_all();

    return frame.widget;
}

var Frame = class Frame {
    constructor() {
        this._settings = ExtensionUtils.getSettings(SCHEMA);

        this._builder = new Gtk.Builder();
        this._builder.add_from_file(Me.path + '/prefs.ui');

        this.widget = this._builder.get_object('settings_notebook');

        let icon_box = this._builder.get_object('icon_box');
        let dock_expand = this._builder.get_object('dock_expand');
        let app_item = this._builder.get_object('app_item');

        dock_expand.add(this.addDirectionCombo());
        dock_expand.add(this.addItemSwitch('Keep dock expanded', KEEP_OPEN));

        icon_box.add(this.addIconSizeCombo());
        icon_box.add(this.addIconFile());

        this.addIndicator();

        app_item.add(this.addItemSwitch('Use system favorite applications', USE_FAVORITES));
        app_item.add(this.addAppCustomer());
    }

    addIndicator() {
        let dash = this._builder.get_object('indicator_dash');
        dash.key = 'dash';
        let dot = this._builder.get_object('indicator_dot');
        dot.key = 'dot';

        dash.connect("toggled", this.radioToggled.bind(this))
        dot.connect("toggled", this.radioToggled.bind(this))

        switch (this._settings.get_string(INDICATOR)) {
        case 'dash':
            dash.set_active(true);
            break;
        case 'dot':
            dot.set_active(true);
            break;
        }
    }

    radioToggled(button) {
        if (!(button.get_active()))
            return;

        this._settings.set_string(INDICATOR, button.key);
    }

    addDirectionCombo() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 margin_top: 5,
                                 margin_bottom: 5,
                                 margin_left: 20,
                                 margin_right: 20,
        });
        let setting_label = new Gtk.Label({  xalign: 0 });
        setting_label.set_markup("Dock direction");
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
                                 margin_top: 5,
                                 margin_bottom: 5,
                                 margin_left: 20,
                                 margin_right: 20,
        });
        let setting_label = new Gtk.Label({  xalign: 0 });
        setting_label.set_markup("Icon size");
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

    addIconFile() {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 margin_top: 5,
                                 margin_bottom: 5,
                                 margin_left: 20,
                                 margin_right: 20,
        });

        let setting_label = new Gtk.Label({  xalign: 0 });
        setting_label.set_markup("Main button icon");
        this.setting_entry = new Gtk.Entry({ hexpand: true, margin_left: 20 });

        this.setting_entry.set_text(this._settings.get_string(ICON_FILE));
        this.setting_entry.connect('changed', (entry) => {
            this._settings.set_string(ICON_FILE, entry.get_text()); });

        this.fileChooseButton = new Gtk.Button({ margin_left: 5 });
        this.fileChooseButton.set_label("Browse");
        this.fileChooseButton.connect("clicked", this.showFileChooserDialog.bind(this));


        hbox.pack_start(setting_label, false, true, 0);
        hbox.add(this.setting_entry);
        hbox.add(this.fileChooseButton);

        return hbox;
    }

    showFileChooserDialog() {
        let fileChooser = new Gtk.FileChooserDialog({ title: "Select File" });
        fileChooser.set_transient_for(this.widget.get_parent());
        fileChooser.set_default_response(1);

        let filter = new Gtk.FileFilter();
        filter.add_pixbuf_formats();
        fileChooser.filter = filter;

        fileChooser.add_button("Cancel", Gtk.ResponseType.CANCEL);
        fileChooser.add_button("Open", Gtk.ResponseType.ACCEPT);

        let preview_image = new Gtk.Image();
        fileChooser.set_preview_widget(preview_image);

        fileChooser.connect('update-preview', (dialog) => {
        dialog.set_preview_widget_active(false);
            let file = fileChooser.get_uris();
            if (file.length > 0 && file[0].startsWith("file://")) {
                file = decodeURIComponent(file[0].substring(7));
            } else {
                return;
            }
            if (GLib.file_test(file, GLib.FileTest.IS_DIR))
                return;
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file(file);
            let maxwidth = 400.0, maxheight = 800.0;
            let width = pixbuf.get_width(), height = pixbuf.get_height();
            let scale = Math.min(maxwidth / width, maxheight / height);
            if (scale < 1) {
                width = width * scale;
                height = height * scale;
                pixbuf = pixbuf.scale_simple(width.toFixed(0), height.toFixed(0), GdkPixbuf.InterpType.BILINEAR);
            }
            preview_image.set_from_pixbuf(pixbuf);
            dialog.set_preview_widget_active(true);
        });

        switch(fileChooser.run()) {
            case Gtk.ResponseType.CANCEL:
                fileChooser.destroy();
                break;
            case Gtk.ResponseType.ACCEPT:
                let file = fileChooser.get_uris();
                if (file.length > 0 && file[0].startsWith("file://"))
                    this.setting_entry.set_text(decodeURIComponent(file[0].substring(7)));
                fileChooser.destroy();
                break;
            default:
        }
    }

    addAppCustomer() {
        let appCustomer = this._builder.get_object('app_customer');
        let appListBox = this._builder.get_object('app_list_box');
        let addButton = this._builder.get_object('add_app');
        let deleteButton = this._builder.get_object('delete_app');


        let appChooserWindow = this._builder.get_object('app_chooser_window');
        addButton.connect('clicked', () => {
            appChooserWindow.set_transient_for(this.widget.get_parent());
            appChooserWindow.show_all();
        });


        let appChooserWidget = this._builder.get_object('app_chooser_widget');
        appChooserWidget.connect('application_activated', (actor, app) => {
            appChooserWindow.hide()

            let name = app.get_filename().split('/');
            let id = name[name.length - 1];

            let row = this.appRow(id);
            if (row) {
                if (this.addAppToList(id))
                    appListBox.add(row);
            }
            appListBox.show_all();
        });

        let apps = (this._settings.get_string(APP_LIST)).split(';');
        apps.forEach( app => {
            let row = this.appRow(app);
            if (row)
                appListBox.add(row);
        });
        appListBox.show_all();

        deleteButton.connect('clicked', () => {
            if (!appListBox.get_activate_on_single_click())
                return;
            let row = appListBox.get_selected_row();
            this.removeAppToList((row.get_children())[0].app);
            appListBox.remove(row);
            appListBox.show_all();
        });

        return appCustomer;
    }

    removeAppToList(app) {
        let apps = (this._settings.get_string(APP_LIST)).split(';');
        let newApps = null;
        for (let i in apps) {
            if (apps[i] != app) {
                if (!newApps)
                    newApps = apps[i];
                else
                    newApps += ';' + apps[i];
            }
        }

        if (newApps == null)
            newApps = '';
        this._settings.set_string(APP_LIST, newApps);
    }

    addAppToList(app) {
        let apps = (this._settings.get_string(APP_LIST)).split(';');
        for (let i in apps) {
            if (apps[i] == app)
                return false;
        }
        apps.push(app);
        let newApps = null;
        apps.forEach( app => {
            if (!newApps)
                newApps = app;
            else
                newApps += ';' + app;
        });
        this._settings.set_string(APP_LIST, newApps);

        return true;
    }

    appRow(appId) {
        let app = null;
        let apps = Gio.AppInfo.get_all();
        for (let i in apps) {
           if (apps[i].get_id() == appId) {
               app = apps[i];
               break;
           }
        }
        if (!app)
            return null;

        let row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        let image = new Gtk.Image();
        let icon = app.get_icon();
        if (!icon)
            icon = new Gio.ThemedIcon({ name: "application-x-executable" });
        image.set_from_gicon(icon, Gtk.IconSize.BUTTON);
        image.set_pixel_size(32);
        let label = new Gtk.Label({ margin_left: 10 });
        label.set_text(app.get_display_name());

        row.add(image);
        row.add(label);
        row.app = appId;

        return row;
    }

    addItemSwitch(string, key) {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL,
                                 margin_top: 5,
                                 margin_bottom: 5,
                                 margin_left: 20,
                                 margin_right: 20,
        });
        let info = new Gtk.Label({xalign: 0});
        info.set_markup(string);
        hbox.pack_start(info, false, false, 0);

        let button = new Gtk.Switch({ active: this._settings.get_boolean(key) });
        button.connect('notify::active', (button) => { this._settings.set_boolean(key, button.active); });
        hbox.pack_end(button, false, false, 0);
        return hbox;
    }

    addBoldTextToBox(text, box) {
        let txt = new Gtk.Label({xalign: 0,
            margin_left: 20,
            margin_right: 20,
            margin_top: 20});
        //txt.set_markup('<b>' + text + '</b>');
        txt.set_markup(text);
        txt.set_line_wrap(true);
        box.add(txt);
    }
};
