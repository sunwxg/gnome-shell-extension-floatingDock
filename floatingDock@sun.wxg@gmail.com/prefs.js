import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SCHEMA = 'org.gnome.shell.extensions.floatingDock';
const HOTKEY = 'floating-dock-hotkey';
const DIRECTION = 'floating-dock-direction';
const ICON_SIZE = 'floating-dock-icon-size';
const ICON_FILE = 'floating-dock-icon-file';
const APP_LIST = 'floating-dock-app-list';
const USE_FAVORITES = 'floating-dock-icon-favorites';
const KEEP_OPEN = 'floating-dock-keep-open';
const INDICATOR = 'floating-dock-indicator';
const CURRENT_WORKSPACE = 'floating-dock-current-workspace-app';
const APPLICATIONS_BUTTON = 'floating-dock-applications-button';

const DIRECTION_LIST = ['up', 'down', 'right', 'left'];
const ICON_SIZE_LIST = [128, 96, 64, 48, 32, 24, 16];
const INDICATOR_TYPE_LIST = ['dot', 'dash'];
const INDICATOR_POSITION_LIST = ['left', 'bottom'];

const GITHUB_URL = 'https://github.com/sunwxg/gnome-shell-extension-floatingDock';

const Frame = class Frame {
    constructor(settings, window) {
        this._settings = settings;
        this._window = window;

        this.pages = [
            this._createSettingsPage(),
            this._createApplicationsPage(),
            this._createAboutPage(),
        ];
    }

    _createSettingsPage() {
        const page = new Adw.PreferencesPage({
            title: 'Settings',
            icon_name: 'preferences-system-symbolic',
        });

        const dockGroup = new Adw.PreferencesGroup({ title: 'Dock' });
        this._addComboRow(dockGroup, 'Dock direction', DIRECTION_LIST,
                          DIRECTION_LIST.indexOf(this._settings.get_string(DIRECTION)),
                          index => { this._settings.set_string(DIRECTION, DIRECTION_LIST[index]); });
        this._addSwitchRow(dockGroup, 'Keep dock expanded', KEEP_OPEN);
        this._addSwitchRow(dockGroup, 'Show current workspace applications', CURRENT_WORKSPACE);
        this._addSwitchRow(dockGroup, 'Show applications button', APPLICATIONS_BUTTON);
        page.add(dockGroup);

        const iconGroup = new Adw.PreferencesGroup({ title: 'Icon' });
        const sizeLabels = ICON_SIZE_LIST.map(size => size.toString());
        this._addComboRow(iconGroup, 'Icon size', sizeLabels,
                          ICON_SIZE_LIST.indexOf(this._settings.get_int(ICON_SIZE)),
                          index => { this._settings.set_int(ICON_SIZE, ICON_SIZE_LIST[index]); });
        iconGroup.add(this._createIconFileRow());
        page.add(iconGroup);

        const indicatorGroup = new Adw.PreferencesGroup({ title: 'Indicator' });
        const [type, position] = this._settings.get_value(INDICATOR).deep_unpack();
        this._addComboRow(indicatorGroup, 'Indicator type', INDICATOR_TYPE_LIST,
                          INDICATOR_TYPE_LIST.indexOf(type),
                          index => { this._setIndicator(INDICATOR_TYPE_LIST[index], null); });
        this._addComboRow(indicatorGroup, 'Indicator position', INDICATOR_POSITION_LIST,
                          INDICATOR_POSITION_LIST.indexOf(position),
                          index => { this._setIndicator(null, INDICATOR_POSITION_LIST[index]); });
        page.add(indicatorGroup);

        return page;
    }

    _setIndicator(type, position) {
        let [currentType, currentPosition] = this._settings.get_value(INDICATOR).deep_unpack();
        if (type === null)
            type = currentType;
        if (position === null)
            position = currentPosition;
        this._settings.set_value(INDICATOR, new GLib.Variant('as', [type, position]));
    }

    _createIconFileRow() {
        const row = new Adw.ActionRow({ title: 'Change control button icon' });
        const entry = new Gtk.Entry({
            hexpand: true,
            valign: Gtk.Align.CENTER,
            text: this._settings.get_string(ICON_FILE),
        });
        entry.connect('changed', () => {
            this._settings.set_string(ICON_FILE, entry.get_text());
        });

        const browseButton = new Gtk.Button({
            label: 'Browse',
            valign: Gtk.Align.CENTER,
        });
        browseButton.connect('clicked', () => {
            this._showFileChooser(entry);
        });

        row.add_suffix(entry);
        row.add_suffix(browseButton);

        return row;
    }

    _showFileChooser(entry) {
        const filter = new Gtk.FileFilter();
        filter.add_pixbuf_formats();

        const dialog = new Gtk.FileDialog({
            title: 'Select File',
            modal: true,
            default_filter: filter,
        });

        dialog.open(this._window, null, (source, result) => {
            try {
                const file = source.open_finish(result);
                if (file)
                    entry.set_text(file.get_path());
            } catch {
            }
        });
    }

    _createApplicationsPage() {
        const page = new Adw.PreferencesPage({
            title: 'Applications',
            icon_name: 'view-app-grid-symbolic',
        });

        const favoritesGroup = new Adw.PreferencesGroup();
        this._addSwitchRow(favoritesGroup, 'Use system favorite applications', USE_FAVORITES);
        page.add(favoritesGroup);

        const appGroup = new Adw.PreferencesGroup({ title: 'User defined application list' });
        const addButton = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Add application',
        });
        addButton.connect('clicked', () => {
            this._showAppChooser(appGroup);
        });
        appGroup.header_suffix = addButton;
        page.add(appGroup);

        const apps = this._settings.get_string(APP_LIST).split(';');
        apps.forEach(app => {
            this._addAppRow(appGroup, app);
        });

        return page;
    }

    _showAppChooser(group) {
        const dialog = new Gtk.AppChooserDialog({
            transient_for: this._window,
            modal: true,
            content_type: 'application/x-executable',
            heading: 'Select Application',
        });

        const appChooser = dialog.get_widget();
        appChooser.show_all = true;
        appChooser.show_recommended = false;

        dialog.add_button('Add', Gtk.ResponseType.OK);
        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        dialog.connect('response', (dlg, response) => {
            if (response === Gtk.ResponseType.OK) {
                const app = dlg.get_app_info();
                if (app)
                    this._addSelectedApp(group, app);
            }
            dlg.destroy();
        });

        dialog.present();
    }

    _addSelectedApp(group, app) {
        const id = app.get_id() ?? app.get_filename()?.split('/').pop() ?? null;
        if (!id)
            return;

        if (!this._appendAppToSetting(id))
            return;

        this._addAppRow(group, id);
    }

    _appendAppToSetting(appId) {
        const apps = this._settings.get_string(APP_LIST).split(';');
        if (apps.includes(appId))
            return false;

        apps.push(appId);
        this._settings.set_string(APP_LIST, apps.join(';'));
        return true;
    }

    _removeAppFromList(appId) {
        const apps = this._settings.get_string(APP_LIST).split(';');
        this._settings.set_string(APP_LIST, apps.filter(app => app !== appId).join(';'));
    }

    _addAppRow(group, appId) {
        const appInfo = this._findAppInfo(appId);
        if (!appInfo)
            return;

        const row = new Adw.ActionRow({ title: appInfo.get_display_name() });

        const image = new Gtk.Image({ pixel_size: 32 });
        const icon = appInfo.get_icon() ?? new Gio.ThemedIcon({ name: 'application-x-executable' });
        image.set_from_gicon(icon);
        row.add_prefix(image);

        const removeButton = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            has_frame: false,
            valign: Gtk.Align.CENTER,
            tooltip_text: 'Remove application',
        });
        removeButton.connect('clicked', () => {
            this._removeAppFromList(appId);
            group.remove(row);
        });
        row.add_suffix(removeButton);

        group.add(row);
    }

    _findAppInfo(appId) {
        return Gio.AppInfo.get_all().find(app => app.get_id() === appId) ?? null;
    }

    _createAboutPage() {
        const page = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });

        const group = new Adw.PreferencesGroup();
        group.add(new Adw.ActionRow({ title: 'Xiaoguang Wang' }));

        const linkRow = new Adw.ActionRow({
            title: 'GitHub',
            subtitle: GITHUB_URL,
            activatable: true,
        });
        const launcher = new Gtk.UriLauncher({ uri: GITHUB_URL });
        linkRow.connect('activated', () => {
            launcher.launch(this._window, null).catch(() => {});
        });
        group.add(linkRow);

        page.add(group);

        return page;
    }

    _addSwitchRow(group, title, key) {
        const row = new Adw.SwitchRow({ title });
        this._settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        return row;
    }

    _addComboRow(group, title, items, selected, callback) {
        const row = new Adw.ComboRow({
            title,
            model: Gtk.StringList.new(items),
        });
        if (selected >= 0)
            row.selected = selected;
        row.connect('notify::selected', () => {
            callback(row.selected);
        });
        group.add(row);
        return row;
    }
};

export default class DictPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const frame = new Frame(this.getSettings(), window);
        frame.pages.forEach(page => window.add(page));
    }
}
