'use strict';
//=============================================================================
/*
базовый класс

--- how to inherit

//constructor
function SubClass() {
}

SubClass.prototype = new GenericBaseClass();//inherit from
//optional. to be able to call GenericBaseClass methods
SubClass.prototype.SuperClass = GenericBaseClass.prototype;

--- how to call GenericBaseClass methods

  this.SuperClass.ancestor_method.call(this [,args...]);

*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function GenericBaseClass(options) {
  //! this Must be overriden in descendants
  //this.C = this.constructor;
  this.C = GenericBaseClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  //! call this only in descendants
  //this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.log_enabled = false;
  //this.log_enabled = true;
}

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

GenericBaseClass.prototype.log = function (msg) {
  if (this.log_enabled) {
    console.log(msg);
  }
};

GenericBaseClass.prototype.warning = function (msg) {
  this.log('warning: ' + msg);
};

//html headings: h1 to h6
GenericBaseClass.prototype.log_heading1 = function (msg) {
  this.log('=============== ' + msg);
};
GenericBaseClass.prototype.log_heading2 = function (msg) {
  this.log('-=-=-=-=-=- ' + msg);
};
GenericBaseClass.prototype.log_heading3 = function (msg) {
  this.log('--------- ' + msg);
};
GenericBaseClass.prototype.log_heading4 = function (msg) {
  this.log('----- ' + msg);
};
GenericBaseClass.prototype.log_heading5 = function (msg) {
  this.log('--- ' + msg);
};
GenericBaseClass.prototype.log_heading6 = function (msg) {
  this.log('-- ' + msg);
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

GenericBaseClass.prototype.PostToQueue = function (to_execute) {
  this.PostToQueueEx(to_execute.bind(this));
};

//returns timeout_id
GenericBaseClass.prototype.PostToQueueEx = function (to_execute) {
  return window.setTimeout(to_execute, 0);//second param = delay
};

GenericBaseClass.prototype.PostToQueueCancel = function (timeout_id) {
  window.clearTimeout(timeout_id);//Passing an invalid ID to clearTimeout() silently does nothing; no exception is thrown.
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

GenericBaseClass.prototype.static_properties_init = function () {
  this.log('GenericBaseClass.static_properties_init');
  if (!this.C.static_properties_initialized) {
    this._static_properties_init();
  }
  this.C.static_properties_initialized = true;
};

//to be overriden in descendants
GenericBaseClass.prototype._static_properties_init = function () {
  console.log('GenericBaseClass._static_properties_init');
  //this.log('GenericBaseClass._static_properties_init');
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//-----------------------------------------------------------------------------
//=============================================================================
