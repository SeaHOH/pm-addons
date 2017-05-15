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

function RDF() {
	this._ds = Cc["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"]
				.createInstance(Ci.nsIRDFDataSource);
}

RDF.prototype = {
	
	get NS_CACHEVIEWER() {
		return "scriptkitz@gmail.com/cacheviewer2#";
	},
	
	get RDF_ITEM_ROOT() {
		return "urn:cache:item:root";
	},
	
	get RDF_ITEM_SEARCH() {
		return "urn:cache:item:search";
	},
	
	get datasource() {
		return this._ds;
	},
	
	get rdfService() {
		if ( !this._rdfService ) {
			this._rdfService = Cc['@mozilla.org/rdf/rdf-service;1']
									.getService(Ci.nsIRDFService);
		}
		return this._rdfService;
	},
	_rdfService: null,
	
	get rdfContainerUtils() {
		if ( !this._rdfContainerUtils ) {
			this._rdfContainerUtils = Cc['@mozilla.org/rdf/container-utils;1']
									.getService(Ci.nsIRDFContainerUtils);
		}
		return this._rdfContainerUtils;
	},
	_rdfContainerUtils: null,
	
	getResource: function(aResourceID) {
		return this.rdfService.GetResource(aResourceID);
	},
	
	getLiteral: function(aValue) {
		return this.rdfService.GetLiteral(aValue);
	},
	
	getIntLiteral: function(aValue) {
		return this.rdfService.GetIntLiteral(aValue);
	},
	
	getDateLiteral: function(aValue) {
		return this.rdfService.GetDateLiteral(aValue);
	},
	
	setLiteralProperty: function(aResource, aProperty, aValue) {
		var property = this.getResource(aProperty);
		var value = this.getLiteral(aValue);
		
		this._ds.Assert(aResource, property, value, true);
	},
	
	getLiteralProperty: function(aResource, aProperty) {
		var target = this._ds.GetTarget(aResource, this.getResource(aProperty), true);
		if (target) return target.QueryInterface(Ci.nsIRDFLiteral).Value;
		return null;
	},
	
	setIntProperty: function(aResource, aProperty, aValue) {
		var property = this.getResource(aProperty);
		var value = this.getIntLiteral(aValue);
		
		this._ds.Assert(aResource, property, value, true);
	},
	
	getIntProperty: function(aResource, aProperty) {
		var target = this._ds.GetTarget(aResource, this.getResource(aProperty), true);
		if (target) return target.QueryInterface(Ci.nsIRDFInt).Value;
		return null;
	},
	
	setDateProperty: function(aResource, aProperty, aValue) {
		var property = this.getResource(aProperty);
		var value = this.getDateLiteral(aValue);
		
		this._ds.Assert(aResource, property, value, true);
	},
	
	getDateProperty: function(aResource, aProperty) {
		var target = this._ds.GetTarget(aResource, this.getResource(aProperty), true);
		if (target) return target.QueryInterface(Ci.nsIRDFDate).Value;
		return null;
	},
	
	appendResource: function(aResource, aParentContainer) {
		if (aParentContainer) {
			aParentContainer.AppendElement(aResource);
		}
		return aResource;
	},
	
	removeResource: function(aResource, aParentContainer) {
		
		// è¦ªã‚³ãƒ³ãƒ†ãƒŠã�‹ã‚‰ãƒªã‚½ãƒ¼ã‚¹ã‚’å‰Šé™¤
		if (aParentContainer) {
			aParentContainer.RemoveElement(aResource, true);
		}
		
		// ãƒªã‚½ãƒ¼ã‚¹ã‚’å‰Šé™¤
		var names = this._ds.ArcLabelsOut(aResource);
		var name, value;
		while (names.hasMoreElements()) {
			name = names.getNext().QueryInterface(Ci.nsIRDFResource);
			value = this._ds.GetTarget(aResource, name, true);
			this._ds.Unassert(aResource, name, value);
		}
		
	},
	
	makeSeqContainer: function(aResourceID) {
		var containerRes = this.getResource(aResourceID);
		return this.rdfContainerUtils.MakeSeq(this._ds, containerRes);
	},
	
	getContainer: function(aResourceID) {
		try {
			var containerRes = this.getResource(aResourceID);
			var rdfContainer = Cc["@mozilla.org/rdf/container;1"]
						.createInstance(Ci.nsIRDFContainer);
			rdfContainer.Init(this._ds, containerRes);
			return rdfContainer;
		} catch(ex) {}
		return this.makeSeqContainer(aResourceID);
	},
	
	clearContainer: function(aResourceID) {
		var container = this.getContainer(aResourceID);
		while (container.GetCount()) {
			container.RemoveElementAt(1, true);
		}
	}
};
