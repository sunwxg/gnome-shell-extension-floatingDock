import Clutter from 'gi://Clutter';
import St from 'gi://St';

export const NUMBER_TO_CHAR_UPPERCASE = [
Clutter.KEY_A,
Clutter.KEY_B,
Clutter.KEY_C,
Clutter.KEY_D,
Clutter.KEY_E,
Clutter.KEY_F,
Clutter.KEY_G,
Clutter.KEY_H,
Clutter.KEY_I,
Clutter.KEY_J,
Clutter.KEY_K,
Clutter.KEY_L,
Clutter.KEY_M,
Clutter.KEY_N,
Clutter.KEY_O,
Clutter.KEY_P,
Clutter.KEY_Q,
Clutter.KEY_R,
Clutter.KEY_S,
Clutter.KEY_T,
Clutter.KEY_U,
Clutter.KEY_V,
Clutter.KEY_W,
Clutter.KEY_X,
Clutter.KEY_Y,
Clutter.KEY_Z,
];

export const NUMBER_TO_CHAR = [
 Clutter.KEY_a,
 Clutter.KEY_b,
 Clutter.KEY_c,
 Clutter.KEY_d,
 Clutter.KEY_e,
 Clutter.KEY_f,
 Clutter.KEY_g,
 Clutter.KEY_h,
 Clutter.KEY_i,
 Clutter.KEY_j,
 Clutter.KEY_k,
 Clutter.KEY_l,
 Clutter.KEY_m,
 Clutter.KEY_n,
 Clutter.KEY_o,
 Clutter.KEY_p,
 Clutter.KEY_q,
 Clutter.KEY_r,
 Clutter.KEY_s,
 Clutter.KEY_t,
 Clutter.KEY_u,
 Clutter.KEY_v,
 Clutter.KEY_w,
 Clutter.KEY_x,
 Clutter.KEY_y,
 Clutter.KEY_z,
];

export function getPosition(direction) {
    let StPosition;
    switch (direction) {
    case 'up':
        StPosition = St.Side.TOP;
        break;
    case 'down':
        StPosition = St.Side.BOTTOM;
        break;
    case 'left':
        StPosition = St.Side.LEFT;
        break;
    case 'right':
        StPosition = St.Side.RIGHT;
        break;
    default:
        break;
    }
    return StPosition;
}

export function appInActiveWorkspace(app) {
        let windows = app.get_windows();
        for ( let i in windows) {
            if (windowInActiveWorkspace(windows[i]))
                return true;
        }
        return false;
}

export function windowInActiveWorkspace(window) {
        let activeWorkspace = global.workspace_manager.get_active_workspace_index();
        return window.get_workspace().index() == activeWorkspace;
}

export function windowsInActiveWorkspace(app) {
        let current = [];
        let windows = app.get_windows();
        for ( let i in windows) {
            if (windowInActiveWorkspace(windows[i]))
                current.push(windows[i]);
        }
        return current;
}

export function appIsOpen(app) {
        let windows = app.get_windows();
        return windows.length > 0 ? true : false;
}
