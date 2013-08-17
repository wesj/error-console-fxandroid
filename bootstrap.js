const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// Dynamically generates a classID for our component, registers it to mask
// the existing component, and stored the masked components classID to be
// restored later, when we unregister.
function registerTemporaryComponent(comp)
{
  let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
  if (!comp.prototype.classID) {
    let uuidgen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);
    comp.prototype.classID = uuidgen.generateUUID();
  }
  // comp.prototype.maskedClassID = Components.ID(Cc[comp.prototype.contractID].number);
  if (!comp.prototype.factory)
    comp.prototype.factory = getFactory(comp);
  registrar.registerFactory(comp.prototype.classID, "", comp.prototype.contractID, comp.prototype.factory);
}

function unregisterTemporaryComponent(comp)
{
  let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
  registrar.unregisterFactory(comp.prototype.classID, comp.prototype.factory);
  // registrar.registerFactory(comp.prototype.maskedClassID, "", comp.prototype.contractID, null);
}

// Stolen from XPCOMUtils, since this handy function is not public there
function getFactory(comp) {
  return {
    createInstance: function (outer, iid) {
      if (outer)
        throw Cr.NS_ERROR_NO_AGGREGATION;
      return (new comp()).QueryInterface(iid);
    }
  }
}

function AboutConsoleHandler() { }
AboutConsoleHandler.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
  contractID: "@mozilla.org/network/protocol/about;1?what=console",

  newChannel: function(aURI) {
    var channel = Services.io.newChannel("chrome://console/content/console.html", null, null);
    channel.originalURI = aURI;
    return channel;
  },

  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  }
}

var menuid;
function loadIntoWindow(window) {
  if (!window)
    return;

  menuid = window.NativeWindow.menu.add({
    name: "Console",
    parent: window.NativeWindow.menu.toolsMenuID,
    icon: "",
    callback: function() {
        window.BrowserApp.addTab("about:console", { });
    }
  });
}

function unloadFromWindow(window) {
  if (!window)
    return;

  if (menuid)
    window.NativeWindow.menu.remove(menuid);
}

var windowListener = {
  onOpenWindow: function(aWindow) {
    // Wait for the window to finish loading
    let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    domWindow.addEventListener("load", function() {
      domWindow.removeEventListener("load", arguments.callee, false);
      loadIntoWindow(domWindow);
    }, false);
  },
  
  onCloseWindow: function(aWindow) {
  },
  
  onWindowTitleChange: function(aWindow, aTitle) {
  }
};

function startup(aData, aReason) {
  // Load into any existing windows
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    loadIntoWindow(domWindow);
  }

  // Load into any new windows
  Services.wm.addListener(windowListener);
  registerTemporaryComponent(AboutConsoleHandler);
}

function shutdown(aData, aReason) {
  // When the application is shutting down we normally don't have to clean
  // up any UI changes made
  if (aReason == APP_SHUTDOWN)
    return;

  // Stop listening for new windows
  Services.wm.removeListener(windowListener);

  // Unload from any existing windows
  let windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    let domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    unloadFromWindow(domWindow);
  }
  unregisterTemporaryComponent(AboutConsoleHandler);
}

function install(aData, aReason) {
}

function uninstall(aData, aReason) {
}
