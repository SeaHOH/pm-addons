/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is CacheViewer.
 *
 * The Initial Developer of the Original Code is The Tiny BENKI.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * The Tiny BENKI. All Rights Reserved.
 *
 * Contributor(s): The Tiny BENKI
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function nsAboutCacheViewer() {}

nsAboutCacheViewer.prototype = {
	
	getURIFlags: function ACV_getURIFlags(aURI) {
		return 0;
	},
	
	newChannel: function ACV_newChannel(aURI) {
		var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
		var key = aURI.spec.substr(19); // 19-->len(cacheviewer2)
		var channel = ioService.newChannel(key, null, null).QueryInterface(Ci.nsIHttpChannel);
		channel.loadFlags = Ci.nsICachingChannel.LOAD_NO_NETWORK_IO |
							Ci.nsICachingChannel.LOAD_ONLY_FROM_CACHE |
							Ci.nsICachingChannel.LOAD_CHECK_OFFLINE_CACHE;
		return channel;
	},
	
	classDescription: "About Module for about:cacheviewer2",
	classID: Components.ID("{4B5A95B7-4A74-4de4-A2EA-765DAAE564AE}"),
	contractID: "@mozilla.org/network/protocol/about;1?what=cacheviewer2",
	QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule])
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([nsAboutCacheViewer]);
