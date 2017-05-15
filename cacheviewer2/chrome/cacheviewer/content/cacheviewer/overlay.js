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
 
function showCacheViewer() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefBranch);
	var sepwin = pref.getBoolPref("extensions.cacheviewer2.open_in_separate_window");
	var needToOpen = true;
	var windowType = "CacheViewer";
	if (sepwin) {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var windows = wm.getEnumerator(windowType);
		while (windows.hasMoreElements()) {
			var theEM = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
			if (theEM.document.documentElement.getAttribute("windowtype") == windowType) {
				theEM.focus();
				needToOpen = false;
	 			break;
			}
		}
		if (needToOpen) {
			const EMURL = "chrome://cacheviewer/content/cacheviewer.xul";
			const EMFEATURES = "chrome, all, dialog=no, centerscreen";
			window.openDialog(EMURL, "", EMFEATURES);
		}
	} else {
		var tab = getBrowser().mTabContainer.firstChild;
		while (tab) {
			if (getBrowser().getBrowserForTab(tab).contentDocument.documentElement.getAttribute("windowtype") == windowType) {
				getBrowser().selectedTab = tab;
				needToOpen = false;
				break;
			}
			tab = tab.nextSibling;
		}
		if (needToOpen) {
			getBrowser().selectedTab = getBrowser().addTab("chrome://cacheviewer/content/cacheviewer.xul");
		}
	}
}