// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import Gtk from 'gi://Gtk';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {DockBox} from './dockBox.js';
import * as Util from './util.js';

const SCHEMA = 'org.gnome.shell.extensions.floatingDock';
const HOTKEY = 'floating-dock-hotkey';
const DIRECTION = 'floating-dock-direction';
const ICON_SIZE = 'floating-dock-icon-size';
const ICON_FILE = 'floating-dock-icon-file';


class FloatDock {
    constructor(settings, dir) {
        this._gsettings = settings;

        let params = {direction: Util.getPosition(this._gsettings.get_string(DIRECTION)),
                      iconSize: this._gsettings.get_int(ICON_SIZE),
                      dir: dir,
                      settings: this._gsettings };

        this.dockBox = new DockBox(params);

        this.directionID = this._gsettings.connect("changed::" + DIRECTION, () => {
            params.direction = Util.getPosition(this._gsettings.get_string(DIRECTION));
            this.dockBox.destroy();
            this.dockBox = new DockBox(params);
        });

        this.iconsizeID = this._gsettings.connect("changed::" + ICON_SIZE, () => {
            params.iconSize = this._gsettings.get_int(ICON_SIZE);
            this.dockBox.destroy();
            this.dockBox = new DockBox(params);
        });

        this._addKeybinding();
    }

    _addKeybinding() {
        let ModeType = Shell.hasOwnProperty('ActionMode') ?
                       Shell.ActionMode : Shell.KeyBindingMode;

        Main.wm.addKeybinding(HOTKEY,
                              this._gsettings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              () => { this.dockBox.vimShow(); });
    }

    destroy() {
        this._gsettings.disconnect(this.directionID);
        this._gsettings.disconnect(this.iconsizeID);
        Main.wm.removeKeybinding(HOTKEY);
        this.dockBox.destroy();
    }
}

export default class FloatingDockExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.floatDock = null;
        this._startupPreparedId = 0;
    }

    enable() {
        this._settings = this.getSettings();

        // wait until the startup process has ended
        if (Main.layoutManager._startingUp)
            this._startupPreparedId = Main.layoutManager.connect('startup-complete', () => this.enableFloatDock());
        else
            this.enableFloatDock();
    }

    disable() {
        this.floatDock.destroy();
        this.floatDock = null;
        this._settings = null;
    }

    enableFloatDock() {
        if (this._startupPreparedId)
            Main.layoutManager.disconnect(this._startupPreparedId);
        this._startupPreparedId = 0;

        this.floatDock = new FloatDock(this._settings, this.dir);
    }
}
