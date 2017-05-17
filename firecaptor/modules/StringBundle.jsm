"use strict";
const EXPORTED_SYMBOLS = ["StringBundleService"];  
Components.utils.import("resource://gre/modules/Services.jsm");

function StringBundleService(uri) {
    if (Object.prototype.toString.apply(uri) !== "[object String]") return null;
    try {
        let locale = Services.prefs.getCharPref("general.useragent.locale");
        let _uri = uri.replace(/(\/[^\/]*)$/, "\/" +  locale + "$1");
        let bundle = _createBundle(_uri);
        bundle.getSimpleEnumeration();
        return bundle;
    } catch (ex) {}
    try {
        let locale = "en-US";
        let _uri = uri.replace(/(\/[^\/]*)$/, "\/" + locale + "$1");
        let bundle = _createBundle(_uri);
        bundle.getSimpleEnumeration();
        return bundle;
    } catch (ex) {}
    return null;
}

function _createBundle(uri) {
    Services.strings.flushBundles();
    return Services.strings.createBundle(uri);
}
