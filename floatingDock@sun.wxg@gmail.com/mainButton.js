import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {SwitchWorkspace} from './switchWorkspace.js';

const ICON_FILE = 'floating-dock-icon-file';
const DELAY = 3000;

export const MainButton = GObject.registerClass(
class MainButton extends St.Button {
    _init(iconSize, settings, dir) {
        super._init({ name: 'floating-dock-main-button' });

        this.settings = settings;
        this.iconSize = iconSize;
        this.dir = dir;
        this._watchId = 0;
        this._mouseIn = false;
        this._show = false;

        this.container = new St.Widget({
            width: this.iconSize,
            height: this.iconSize,
        });
        this.set_child(this.container);

        this.icon = new St.Icon({ gicon: this._createButtonIcon(),
                                  icon_size: this.iconSize });
        this.container.add_child(this.icon);

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this.transparentIcon = new St.Widget({
            name: 'floating-dock-transparent-button',
            x: 0,
            y: 0,
            width: this.iconSize * scaleFactor,
            height: this.iconSize * scaleFactor,
        });

        let switchWorkspace = new SwitchWorkspace();
        this.connect('scroll-event', switchWorkspace.scrollEvent.bind(switchWorkspace));

        this.iconFileID = this.settings.connect("changed::" + ICON_FILE, () => {
            let child = this.container.get_first_child();
            this.container.remove_child(child);
            this.icon = new St.Icon({ gicon: this._createButtonIcon(),
                                      icon_size: this.iconSize });
            this.container.add_child(this.icon);
            this._addWatch();
        });

        Main.layoutManager.addChrome(this, { trackFullscreen: true });

        this._addWatch();
    }

    _createButtonIcon() {
        let uri = this.settings.get_string(ICON_FILE)
        if (!GLib.file_test(uri, GLib.FileTest.EXISTS))
            uri = this.dir.get_path() + '/icons/flag.png';

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
        if (this.container.get_first_child() == this.transparentIcon) {
            this.container.remove_child(this.transparentIcon);
            this.container.add_child(this.icon);
        }
    }

    _hideIcon() {
        if (this.container.get_first_child() == this.icon) {
            this.container.remove_child(this.icon);
            this.container.add_child(this.transparentIcon);
        }
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
