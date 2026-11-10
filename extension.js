import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

const KS_STEP_S = 100;
const MAX_WAIT_S = 60;
const RETRY_S = 60;
const GLYPHS = {'☉': 'noon', '○': 'midnight', '△': 'sunrise', '▽': 'sunset'};
const LINE_RATIO = 0.3;
const DOT_RATIO = 2.6 / 9;

async function bz(args, cancellable) {
    const proc = Gio.Subprocess.new(['bz', ...args],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [stdout, stderr] = await proc.communicate_utf8_async(null, cancellable);
    if (!proc.get_successful())
        throw new Error(stderr.trim() || `bz exited with status ${proc.get_exit_status()}`);
    return stdout;
}

function secondsToNextStep(reading, kiloseconds) {
    const toNextKs = (Math.floor(reading.offset_s / KS_STEP_S) + 1) * KS_STEP_S - reading.offset_s;
    let wait = toNextKs;
    if (reading.span !== null) {
        const toNextSpan = (Math.floor(reading.span) + 1 - reading.span) * reading.span_s;
        wait = kiloseconds ? Math.min(toNextKs, toNextSpan) : toNextSpan;
    }
    return Math.min(Math.max(wait, 0), MAX_WAIT_S);
}

const Glyph = GObject.registerClass(
class Glyph extends St.DrawingArea {
    _init() {
        super._init({style_class: 'bogenzeit-glyph', y_align: Clutter.ActorAlign.CENTER});
        this._glyph = 'noon';
    }

    set glyph(glyph) {
        if (glyph === this._glyph)
            return;
        this._glyph = glyph;
        this.queue_repaint();
    }

    vfunc_repaint() {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();
        const radius = Math.min(width, height) / (2 + LINE_RATIO);
        const [x, y] = [width / 2, height / 2];
        const color = this.get_theme_node().get_foreground_color();
        cr.setSourceRGBA(color.red / 255, color.green / 255, color.blue / 255, color.alpha / 255);
        cr.setLineWidth(radius * LINE_RATIO);
        cr.setLineJoin(Cairo.LineJoin.ROUND);

        if (this._glyph === 'sunrise' || this._glyph === 'sunset') {
            const apex = this._glyph === 'sunrise' ? -radius : radius;
            cr.moveTo(x, y + apex);
            cr.lineTo(x - radius, y - apex);
            cr.lineTo(x + radius, y - apex);
            cr.closePath();
        } else {
            cr.arc(x, y, radius, 0, 2 * Math.PI);
        }
        cr.stroke();

        if (this._glyph === 'noon') {
            cr.arc(x, y, radius * DOT_RATIO, 0, 2 * Math.PI);
            cr.fill();
        }
        cr.$dispose();
    }
});

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.5, 'Bogenzeit');
        this.add_style_class_name('bogenzeit-button');
        this._settings = settings;

        const reading = new St.BoxLayout({style_class: 'bogenzeit-reading'});
        this._before = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this._glyph = new Glyph();
        this._after = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        reading.add_child(this._before);
        reading.add_child(this._glyph);
        reading.add_child(this._after);
        this.add_child(reading);
        this._show('…');

        this._error = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._error.visible = false;
        this.menu.addMenuItem(this._error);

        const unit = new PopupMenu.PopupSwitchMenuItem('Kiloseconds', settings.get_boolean('kiloseconds'));
        unit.connect('toggled', (_item, state) => settings.set_boolean('kiloseconds', state));
        this.menu.addMenuItem(unit);

        settings.connectObject('changed::kiloseconds', () => {
            unit.setToggleState(settings.get_boolean('kiloseconds'));
            this._refresh();
        }, this);

        this._refresh();
    }

    async _refresh() {
        this._clearTimer();
        this._cancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;

        const kiloseconds = this._settings.get_boolean('kiloseconds');
        let wait;
        try {
            const reading = JSON.parse(await bz(['--json'], cancellable));
            const text = await bz(['--form', kiloseconds ? 'offset' : 'span', '--precision', 'low'], cancellable);
            this._show(text.split('\n')[0].split(' | ').pop());
            this._error.visible = false;
            wait = secondsToNextStep(reading, kiloseconds);
        } catch (e) {
            if (e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;
            this._show('bz ?');
            this._error.label.text = e.message;
            this._error.visible = true;
            wait = RETRY_S;
        }
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.ceil(wait * 1000) + 50, () => {
            this._timer = 0;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _show(text) {
        const at = text.split('').findIndex(c => c in GLYPHS);
        const glyph = at >= 0 ? text[at] : null;
        const before = glyph ? text.slice(0, at).trim() : text;
        const after = glyph ? text.slice(at + 1).trim() : '';
        this._before.text = before;
        this._before.visible = before !== '';
        this._after.text = after;
        this._after.visible = after !== '';
        this._glyph.visible = glyph !== null;
        if (glyph)
            this._glyph.glyph = GLYPHS[glyph];
    }

    _clearTimer() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
    }

    destroy() {
        this._clearTimer();
        this._cancellable?.cancel();
        super.destroy();
    }
});

export default class BogenzeitExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this.getSettings());
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'center');
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
