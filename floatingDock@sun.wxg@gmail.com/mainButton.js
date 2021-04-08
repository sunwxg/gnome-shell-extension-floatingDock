const { GLib, Clutter, Gio, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const SwitchWorkspace = Me.imports.switchWorkspace.SwitchWorkspace;

const ICON_FILE = 'floating-dock-icon-file';
const DELAY = 3000;

var MainButton = GObject.registerClass(
class MainButton extends St.Button {
    _init(iconSize, settings) {
        super._init({ name: 'floating-dock-main-button' });

        this.settings = settings;
        this.iconSize = iconSize;
        this._watchId = 0;
        this._mouseIn = false;
        this._show = false;

        this.container = new St.Widget({
            x: 0,
            y: 0,
            width: this.iconSize,
            height: this.iconSize,
        });
        this.set_child(this.container);

        this.icon = new St.Icon({ gicon: this._createButtonIcon(), });
        this.container.add_child(this.icon);

        let switchWorkspace = new SwitchWorkspace();
        this.connect('scroll-event', switchWorkspace.scrollEvent.bind(switchWorkspace));

        this.iconFileID = this.settings.connect("changed::" + ICON_FILE, () => {
            if (this.container.get_children().length)
                this.container.remove_child(this.icon);
            this.icon = new St.Icon({ gicon: this._createButtonIcon(), });
            this._showIcon();
            this._addWatch();
        });

        Main.layoutManager.addChrome(this, { trackFullscreen: true });

        this._addWatch();
    }

    _createButtonIcon() {
        let uri = this.settings.get_string(ICON_FILE)
        if (!GLib.file_test(uri, GLib.FileTest.EXISTS))
            uri = Me.path + '/icons/flag.png';

        return  new Gio.FileIcon({ file: Gio.File.new_for_path(uri) });
    }

    createDragButton() {
        let icon = new St.Icon({ gicon: this._createButtonIcon(),
                                 icon_size: this.iconSize });
        let button= new St.Button({ name: 'floating-dock-main-button',
                                    child: icon });
        return button;
    }

    _addWatch() {
        if (this._watchId != 0)
            return;

        if (this._show)
            return;

        this._watchId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DELAY, () => {
            this._hideIcon();
            this._watchId = 0;
            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(this._watchId, '[gnome-shell] mainButton show delay');
    }

    _removeWatch() {
        if (this._watchId > 0) {
            GLib.source_remove(this._watchId);
            this._watchId = 0;
        }
    }

    _showIcon() {
        if (this.container.get_children().length == 0) {
            this.icon = new St.Icon({ gicon: this._createButtonIcon(), });
            this.container.add_child(this.icon);
        }
        this.remove_style_class_name('transent-button');
    }

    _hideIcon() {
        if (this.container.get_children().length)
            this.container.remove_child(this.icon);
        this.add_style_class_name('transent-button');
    }

    vfunc_enter_event(crossingEvent) {
        this._mouseIn = true;
        this._removeWatch();
        this._showIcon();
        return super.vfunc_enter_event(crossingEvent);
    }

    vfunc_leave_event(crossingEvent) {
        this._mouseIn = false;
        this._addWatch();
        return super.vfunc_leave_event(crossingEvent);
    }

    showIcon(show) {
        this._show = show;
        if (show || this._mouseIn) {
            this._removeWatch();
            this._showIcon();
        } else {
            this._addWatch();
        }
    }

    destroy() {
        this._removeWatch();
        if (this.iconFileID > 0)
            this.settings.disconnect(this.iconFileID);
        Main.layoutManager.removeChrome(this);
    }
});
