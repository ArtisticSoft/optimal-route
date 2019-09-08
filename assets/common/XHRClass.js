'use strict';
//=============================================================================
/*
XHR request
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function XHRClass(options) {
  //this.C = this.constructor;
  this.C = XHRClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.timeout = options ? options.timeout : this.C.timeout;
  
  //promise-like interface
  this._is_pending = false;
  this._is_fulfilled = false;
  this.on_settle = undefined;
  
  if (XMLHttpRequest) {
    this.xhr = new XMLHttpRequest();
		
//		this._add_listener('loadstart', this._loadstart_handler);
//		this._add_listener('progress', this._progress_handler);
//		this._add_listener('readystatechange', this._readystatechange_handler);
		this._add_listener('load', this._load_handler);
		this._add_listener('error', this._error_handler);
		this._add_listener('abort', this._abort_handler);
		this._add_listener('timeout', this._timeout_handler);
    
  } else {
    this.log('error: XMLHttpRequest not available');
  }
  
}

XHRClass.prototype = new GenericBaseClass();//inherit from
XHRClass.prototype.SuperClass = GenericBaseClass.prototype;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//to be moved to ancestor
/*
XHRClass.prototype.log = function (msg) {
  console.log(msg);
};

XHRClass.prototype.warning = function (msg) {
  this.log('warning: ' + msg);
};
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/*
!important!
options.responseType should match the actual response returned from server
*/
XHRClass.prototype.OpenAndSend = function (options) {
  this.log('OpenAndSend');
  
  if (this.xhr) {
    this.xhr.open(options.method, options.url, true);//last param means Async

    //In Internet Explorer, the timeout property may be set only 
    //after calling the open() method and before calling the send() method.
    this.xhr.timeout = this.timeout;
    
    if (options.responseType) {
      this.xhr.responseType = options.responseType;
    }

    switch (options.method) {
      case 'GET':
        this.xhr.send();
        break;
        
      case 'POST':
        this.xhr.send(options.body);
        break;
        
      default: 
        this.log('unsupported method ['+options.method+']');
    }
  }

};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//event handlers and it's utilities

//utility
XHRClass.prototype._add_listener = function (event, handler) {
  this.xhr.addEventListener(event, handler.bind(this));
};
	
/*
load-ending condition. the only successful ending

!important!
  .responseType should match the actual response returned from server
*/
XHRClass.prototype._load_handler = function (e) {
		let is_ok = false, resp_typ;
		//this._event_dump('_load_handler', e);
		
		if (this.readyState_eq('DONE')) {
			if (this.status_eq('OK')) {
				is_ok = true;
				this.log('---------- load status = OK');
				this.log('getAllResponseHeaders() = ... \n' + this.xhr.getAllResponseHeaders());
				
				//=string
				//this.log('typeof response = ' + typeof this.xhr.response);
				//=String for responseType=""
				if (this.xhr.response) {//response might =null
					this.log('response class = ' + this.xhr.response.constructor.name);
				}
				
				resp_typ = this.xhr.responseType;
				this.log('responseType ['+resp_typ +']');
				switch (resp_typ){
					case 'json':
						//this.log('response body= ...\n' + VUtils.VariableToString(this.xhr.response));
						break;
						
					case '':
					case 'text':
						//responseText is only available if responseType is '' or 'text'
						this.log('----- raw response dump\n'+this.xhr.responseText);
						break;
						
					default:
						this.log('responseType not dumpable yet ['+resp_typ+']');
				}
				
			} else {
				//XMLHttpRequest.statusText text of the response status, such as "OK" or "Not Found"
				this.warning('---------- load failed\n'+'xhr.statusText = '+this.xhr.statusText);
			}
		} else {
			this.warning('unexpected. readyState=['+this.readyStateText+'] at "load" handler');
		}
		this._load_end_handler('load', is_ok, e);
	};

//load-ending condition
//e class = ProgressEvent
XHRClass.prototype._error_handler = function (e) {
  //this._event_dump('_error_handler', e);
  this._load_end_handler('error', false, e);
};

//load-ending condition
//e class = ProgressEvent
XHRClass.prototype._abort_handler = function (e) {
  //this._event_dump('_abort_handler', e);
  this._load_end_handler('abort', false, e);
};
	
//assumed to prepared (before 'send') with 
//	xhr.timeout = timeout;
XHRClass.prototype._timeout_handler = function (e) {
  this._load_end_handler('timeout', false, e);
};
	
//utility
//assumed to be called from every Load-Ending condition handler
XHRClass.prototype._load_end_handler = function (name, is_fulfilled, e) {
  this._pending_leave(is_fulfilled);
  this._load_end_conditon_name = name;
  this.log('load ends. condition['+name+']');
}
	
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//========== promise-like interface ==========

XHRClass.prototype._pending_enter = function () {
		let p = this._is_pending;
		if (!p) {
			this._is_pending = true;
			this._is_fulfilled = false;
		} else {
      this.warning('XHR Request called while previous call is not settled yet');
    }
		return (!p);
	}
	
XHRClass.prototype._pending_leave = function (is_fulfilled) {
  this._is_pending = false;
  this._is_fulfilled = is_fulfilled;
  //synchronous callback
  if (this.on_settle) {
    this.on_settle(this._is_fulfilled);
  }
};
		
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//static properties
/*
XHRClass.prototype.static_properties_init = function () {
  if (!this.C.static_properties_initialized) {
    this._static_properties_init();
  }
  this.C.static_properties_initialized = true;
};
*/
XHRClass.prototype._static_properties_init = function () {
  this.log('XHRClass._static_properties_init');
  
  this.C.timeout = 30000;// time in milliseconds
  
  this.C.readyState_values = {
    //Client has been created. open() not called yet.
    UNSENT: 0,
    //open() has been called.
    OPENED: 1,
    //send() has been called, and headers and status are available.
    HEADERS_RECEIVED: 2,
    //Downloading; responseText holds partial data.
    LOADING: 3,
    //The operation is complete.
    DONE: 4
  };
  
  this.C.status_values = {
    OK: 200,
    Bad_Request: 400,
    Unauthorized: 401,
    Forbidden: 403,
    NotFound: 404,
    MethodNotAllowed: 405,
    NotAcceptable: 406,
    ProxyAuthenticationRequired: 407,
    RequestTimeout: 408,
    Conflict: 409,
    Gone: 410
  };
  
  this.C.responseType_values = [
    //An empty responseType string is treated the same as "text", the default type (therefore, as a DOMString.
    '', 
    //The response is a JavaScript ArrayBuffer containing binary data.
    'arraybuffer', 
    //The response is a Blob object containing the binary data.
    'blob', 
    //The response is an HTML Document or XML XMLDocument, as appropriate based on the MIME type of the received data. 
    //See HTML in XMLHttpRequest to learn more about using XHR to fetch HTML content.
    'document', 
    //The response is a JavaScript object created by parsing the contents of received data as JSON.
    'json', 
    //The response is text in a DOMString object.
    'text', 
    //SPECIAL Similar to 'arraybuffer', but the data is received in a stream... 
    'moz-chunked-arraybuffer',
    //SPECIAL The response is part of a streaming download; this response type is only allowed for download requests, and is only supported by Internet Explorer.
    'ms-stream'
  ];

};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 

//utility
XHRClass.prototype.readyState_eq = function (name){
  return this.xhr.readyState === this.C.readyState_values[name];
};

//this is kinda polyfill, made similar to native .statusText
//XHRClass.prototype.readyStateText = function () {
//  return this.C.readyState_name(this.xhr.readyState);
//};
  
//utility
XHRClass.prototype.status_eq = function (name){
  return this.xhr.status === this.C.status_values[name];
};

//=============================================================================
