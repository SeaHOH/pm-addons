var data = JSON.parse(window.arguments[0]);
var _apply = window.arguments[1];

function KeyShortcuts (elm, callback) {
    arguments.callee.prototype._VK = [];
    var _VK = arguments.callee.prototype._VK;
    _VK[0x08] = '←BackSpace', _VK[0x09] = 'Tab', _VK[0x0D] = 'Enter';
    _VK[0x10] = 'Shift', _VK[0x11] = 'Ctrl', _VK[0x12] = 'Alt', _VK[0x13] = 'Pause';
    _VK[0x1B] = 'Esc', _VK[0x20] = 'Space', _VK[0x21] = 'PageUp';
    _VK[0x22] = 'PageDown', _VK[0x23] = 'End', _VK[0x24] = 'Home', _VK[0x25] = '←';
    _VK[0x26] = '↑', _VK[0x27] = '→', _VK[0x28] = '↓', _VK[0x2D] = 'Ins';
    _VK[0x2E] = 'Del',// _VK[0x5B] = 'LeftWindowsKey', _VK[0x5C] = 'RightWindowsKey';
    _VK[0x5D] = 'Application', _VK[0x6A] = 'num*', _VK[0x6B] = 'num+';
    _VK[0x6C] = 'Separator', _VK[0x6D] = 'num-', _VK[0x6E] = 'num.', _VK[0x6F] = 'num/';
    _VK[0xBC] = ',', _VK[0xBE] = '.', _VK[0xBF] = '/', _VK[0xC0] = '`';
    _VK[0xDB] = '[', _VK[0xDC] = '\\', _VK[0xDD] = ']', _VK[0xDE] = '\'';
    _VK[0xBA] = ';' /* if keycode == 0x3b set _VK[0xBA] */;
    for (var i = 0x30; i < 0x3A; ++i)
        _VK[i] = String(i - 0x30);
    for (var i = 0x41; i < 0x5B; ++i)
        _VK[i] = String.fromCharCode(i);
    for (var i = 0x60; i < 0x6A; ++i)
        _VK[i] = 'num' + (i - 0x60);
    for (var i = 0x70; i < 0x88; ++i)
        _VK[i] = 'F' + (i - 0x6F);
    this.bind = function (tb, callback) {
        if (!(typeof tb == "object" && tb.localName == "input")) return;
        this._elm = tb;
        tb.addEventListener("keydown", this, false);
        if (typeof callback == "function") {
            this._callback = callback;
        }
    };
    this.handleEvent = function (e) {
        var mod = e.shiftKey << 3 | e.metaKey << 2 | e.ctrlKey << 1 | e.altKey;
        if (e.keyCode == e.DOM_VK_TAB && mod == 0) return;
        e.preventDefault();
        var code = e.keyCode;
        var codestr = typeof this._VK[code] == "undefined" ? "unknown" : this._VK[code];
        var modstr = (e.shiftKey && code != 0x10 ? "Shift + " : "")
                   + (e.ctrlKey && code != 0x11 ? "Ctrl + " : "")
                   + (e.altKey && code != 0x12 ? "Alt + " : "");
        this._elm.value = modstr ? modstr + codestr : codestr;
        if (this._callback) {
            var callback = this._callback.bind(this._elm, code, mod);
            callback();
        }
    };
    this.unbind = function () {
        if (this._elm) {
            this._elm.removeEventListener("keydown", this, false);
        }
    };
    this.bind(elm, callback);
}

function $(id) {
    return document.getElementById(id);
}
document.title = data.name;

var enabled = data.enabled;
var keychar = data.keychar;
var code = data.code;
/*
var keycode = code & 0x00FF;
var modcode = code >>> 8;
*/
var keyEnabled = $("key-enabled");
var keySetting = $("key-setting");
var keyApply = $("key-apply");

keyApply.value = data.apply;

function toggle(e) {
    var checked = e.target.checked;
    keySetting.disabled = !checked;
    keyApply.disabled = (checked == enabled && code == __code);
}
keyEnabled.addEventListener("change", toggle, false);
keyEnabled.checked = enabled;
keyEnabled.focus();
keySetting.value = keychar;
keySetting.disabled = !enabled;

var __code = code;
function cb(c, m) {
    var _code = c | m << 8;
    keyApply.disabled = (_code === code && keyEnabled.checked == enabled);
    __code = _code;
}
var key = new KeyShortcuts(keySetting, cb);

function apply() {
    code = __code;
    enabled = keyEnabled.checked;
    var data = {
        enabled: enabled,
        keychar: keySetting.value,
        code   : code
    };
    _apply(JSON.stringify(data));
    keyApply.disabled = true;
    keyEnabled.focus();
}

function exit(e) {
    if (e.keyCode == e.DOM_VK_ESCAPE) {
        e.stopPropagation();
        window.close();
    }
}
window.addEventListener("keydown", exit, true);

window.addEventListener("unload", function () {
    window.removeEventListener("unload", arguments.callee, false);
    window.removeEventListener("keydown", exit, true);
    keyEnabled.removeEventListener("change", toggle, false);
    key.unbind();
}, false);
