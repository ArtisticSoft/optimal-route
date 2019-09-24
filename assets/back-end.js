'use strict';
//=============================================================================
/*
BackEnd

minor mis-inforamation: md_address is actually address_md

//NOTE: if site uses HTTPS then BackEnd must use HTTPS too, 
//else XHR requests will be blocked by the Browser (FireFox at least)

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
UPD sept02
Попробуй заменить 

http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/
testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/

На такую строку 

http://testtest01.itlogist.ru/api/v1/all/
testtest01.itlogist.ru/api/v1/all/

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Подбор адреса - отображаем в списке адресов - address2
Note: может возвращать пустой список = [] - массив а не объект {...} как в случае не-пустого списка

    URL http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/search_address/
    Пример 
    http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/search_address/?address=%D0%92%D0%B5%D0%BB%D0%B8%D0%BA%D0%B0%D1%8F%2012
    GET запрос
    Вход: переменная address
    Выход:

    Негативный: {"result":1,"address_list":[]}
    Позитивный:
    {
    "result":1,

    "address_list":{

      "1":{
        "address":"Россия, Новгородская область, Великий Новгород, Софийская сторона, Великая улица, 12 ",
        "address2":"Великая улица, 12, Софийская сторона, Великий Новгород, Новгородская область, Россия"
      },

      "2":{
        "address":"Беларусь, Гродненская область, Гродненский район, Коптёвский сельсовет, агрогородок Коробчицы, Великая улица, 12 ",
        "address2":"Великая улица, 12, агрогородок Коробчицы, Коптёвский сельсовет, Гродненский район, Гродненская область, Беларусь"
      }
    }

}

---kinda ODD case: 
enter
Невский пр 13
select from suggestions
Невский проезд, 13, Саратов, Россия
enter Space, Backspace
BackEnd returns an empty list
  value [Невский проезд, 13, Саратов, Россия]
  {"result":1,"address_list":[]}
  
the same for
Невский проезд, 13, Саратов

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Геокодинг адреса

    URL http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/geocode/
    Пример
    http://testtest01.itlogist.ru/api/v1/90164b0a8effb826cff235a3761b91eb/geocode/?address=%D0%A0%D0%BE%D1%81%D1%81%D0%B8%D1%8F,%20%D0%9D%D0%BE%D0%B2%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D1%81%D0%BA%D0%B0%D1%8F%20%D0%BE%D0%B1%D0%BB%D0%B0%D1%81%D1%82%D1%8C,%20%D0%92%D0%B5%D0%BB%D0%B8%D0%BA%D0%B8%D0%B9%20%D0%9D%D0%BE%D0%B2%D0%B3%D0%BE%D1%80%D0%BE%D0%B4,%20%D0%A1%D0%BE%D1%84%D0%B8%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%20%D1%81%D1%82%D0%BE%D1%80%D0%BE%D0%BD%D0%B0,%20%D0%92%D0%B5%D0%BB%D0%B8%D0%BA%D0%B0%D1%8F%20%D1%83%D0%BB%D0%B8%D1%86%D0%B0,%2012&save
    GET - запрос
    Вход: переменная address и параметр save (смотрим пример выше)
    Выход: 

    Негативный: {"result":0}
    Позитивный:
minor mis-inforamation: md_address is actually address_md
    {
    "lat":"58.528716",
    "lng":"31.280524",
    "md_address":"dlk23jrd23md3o2dd23dxdw3d2",
    "result":1
    }
    
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Поиск оптимального маршрута - distribution_address
URL http://testtest01.itlogist.ru/api/v1/all/distribution_address/ 
Пример 
POST - запрос 
Вход: переменная address содержит список md_address через запятую, и переменная md_list (если есть)
 
Выход: 
Позитивный:
{
  "result":1,
  "address":{
  "1":"38af2f6336175c317199a69a6ed517ad",
  "2":"b5742034fa159d987c9bd4974b17c9b4",
  "3":"dc2c4a85b13973866d70f2318204c6a0",
  "4":"d2977a0e452f1dcc632812db409e3054"
  },
  "route":{
    "overview_polyline":"gkylJ_``xDkAdRGPMHo@Ia@OcAUe@?[PwAfCeClEaClE[k@Uk@w@uC_Ka`@WmAoBuHe@kBq@kDiAyFZa@zCiDt@o@nB_C~@{AnBuCLQb@kAJs@Bg@b@cLP_E?W?WxDjAtInCvBn@fCp@pGpB\JDm@|@eQrBk]t@iLBk@`Ct@~DrA`@XjAb@xA`@XyC~HtC|Aj@LJIZE|@H|@JZLPNFNARILQJYF]@cAE_@I[NWH_@~@yD|Lfc@fF|QhCdKlB~GdCdInGvU~@xD`@fBZ~BvBjObDjUxB~N`BvLvIbm@`CrP`BjLLjA?bAK|G]dTU~Sa@pWEpGnHdDnFjCnKhFfAd@xGdDpBfAb@Pj@R^C~FgBr@Yv@c@n@g@z@q@Rp@lAbE`@lA^t@TTJFd@NxHbAvAN|Cf@l@J?P@`@Jl@R^LFX?PIb@g@~CsDlBoBbB}AhGuEXOTCd@BpDj@|Ex@zAR`F|@\NTN`C`C|I`Jh@b@fCpCvAxA~GbHpGnGpCvCdA~@rAnAdAjA~K|KbSdSbDhDrGdHlA`AxAtAL`@F`@Ab@BdAN|@Zn@RPLH\@XIZ]Na@Lg@D_@@}Ad@}@PGxJqBlCa@dGwAbI{AtFy@`KqBrHyA|AKbA@^BhATp@Vt@ZtAz@xArApAbBpB`DjAxBjCvF~BvFzExKtDnJbDxI|BrGhEzMtE|NxArFtCtKzCpKf@hBV^jEtNnDfLxBhI`BtGfCpLPz@nAbJ~A`MdCdPfA`Hz@nGXdEz@lRThH?|@fDrFhK~PlGjKrJ|NnQbXpUt]GzjAfFE@oB?m@cBEAcFu@?SjKy@@?jE@pQ?pO?zD?{D?qOA{Jx@??T",
    "points_gps":[
      {
      "lat":59.93668,
      "lng":30.31568
      },
      {
      "lat":59.93706,
      "lng":30.31261
      }
    ]
  },
"md_list":"3y6x430"
//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
Изменение порядка маршрута - distribution_hand

  URL http://testtest01.itlogist.ru/api/v1/all/distribution_hand/ 
  Пример
  POST - запрос
  Вход: address содержит список md_address через запятую по порядку, и переменная md_list (если есть)
  Выход:
  Позитивный:
  {
    "result":1,
    "address":{
    "1":"87365a03d2013fd966f90011021fd297",
    "2":"d4abbd70fa959bcbdf39b1185728ec3f",
    "3":"33ca68b2f84e30afcf6768ed9090e6b6"
  },
  "md_list":"e7b145c8d01f4ee3f1c65357b60c727d"

*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function BackEndClass() {
  //this.C = this.constructor;
  this.C = BackEndClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.onReject = null;//global handler

  //Подбор адреса
  this.AddressSuggestions = {
    name: 'addr_suggestions',
    url: this.C.protocol + '//testtest01.itlogist.ru/api/v1/all/search_address/',
    method: 'GET',
    //список параметров метода. имена параметров берутся отсюда, значения из переданного {...}
    //здесь можно задать значение по умолчанию - для обязательных параметров
    //если Имя не найдено в {...} то значение будет взято отсюда, если оно !== undefined
    //если значение === undefined то параметр необязательный, он будет пропущен если отсутствует в {...}
    params: {address: undefined},
    accept_only_latest: true,
    json_main_key: 'address_list'
  };

  //Геокодинг адреса
  this.AddressGeocode = {
    name: 'addr_geocode',
    url: this.C.protocol + '//testtest01.itlogist.ru/api/v1/all/geocode/',
    method: 'GET',
    params: {address: undefined, save: ''}
  };
  
  //Поиск оптимального маршрута
  //POST - запрос 
  this.DistributionAddress = {
    name: 'distribution_address',
    url: this.C.protocol + '//testtest01.itlogist.ru/api/v1/all/distribution_address/',
    method: 'POST',
    //переменная address содержит список md_address через запятую , и переменная md_list (если есть)
    params: {address: undefined, md_list: undefined}
  };
  
  //Изменение порядка маршрута
  //POST - запрос 
  this.DistributionHand = {
    name: 'distribution_hand',
    url: this.C.protocol + '//testtest01.itlogist.ru/api/v1/all/distribution_hand/',
    method: 'POST',
    //address содержит список md_address через запятую по порядку, и переменная md_list (если есть)
    params: {address: undefined, md_list: undefined}
  };
  
  //пул запросов. дерево. для каждого метода своя ветка с массивом запросов
  this.xhr_pool = {
    addr_suggestions: {count: 0, list:[], wait_for_idx: null},
    addr_geocode: {count: 0, list:[]},
    distribution_address: {count: 0, list:[]},
    distribution_hand: {count: 0, list:[]}
  };
}

BackEndClass.prototype = new GenericBaseClass();//inherit from
BackEndClass.prototype.SuperClass = GenericBaseClass.prototype;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

BackEndClass.prototype.XHR_Start = function (method, query, on_resolve, on_reject) {
  this.log_heading3('XHR_Start. method.name ['+method.name+']');
  
  this.log('query');
  this.log(query);
  
  var xhr_obj = new XHRClass({timeout: this.C.timeout_delay});
  var xhr_idx = this.xhr_pool_append(method.name, xhr_obj);//this includes wait_for_idx update if any
  xhr_obj.handle = {method: method, idx: xhr_idx};
  
  //xhr_obj.log_enabled = true;
  //XHRClass native callback
  xhr_obj.on_settle = this.XHR_onSettle.bind(this, xhr_obj);
  //bind a custom callbacks to be called from XHR_onSettle
  xhr_obj.on_resolve = on_resolve;
  if (on_reject) {
    xhr_obj.on_reject = on_reject;
  }
  
  var url = new URL(method.url);
  var keys = Object.keys(method.params);
  var k;
  var v;
  for (var i = 0; i < keys.length; i++) {
    k = keys[i];
    v = query[k] ? query[k] : method.params[k];
    if (v !== undefined) {
      url.searchParams.append(k, v);
    }
  }
  this.log('url.href ['+url.href+']');
  
  //! important to set responseType = match the actual type from server, else Will be troubles
  xhr_obj.OpenAndSend({method: method.method, url: url.href, responseType: 'json'});
  
  return xhr_obj.handle;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
//xhr pool append \ remove

BackEndClass.prototype.xhr_pool_append = function (method_name, xhr_obj) {
  this.log_heading5('xhr_pool_append');

  var pool = this.xhr_pool[method_name];
  var idx = pool.list.push(xhr_obj) - 1;//-1 because push returns new length, not index
  //sort of trick. if wait_for_idx missed, it == undefined. 
  //if wait_for_idx defined, it == null or something
  if (pool.wait_for_idx !== undefined) {
    pool.wait_for_idx = idx;
  }
  pool.count++;
  if (pool.count > 1) {
    this.log(this.xhr_pool_toStr('pool dump after', method_name));
  }
  return idx;
};

BackEndClass.prototype.xhr_pool_waitFor_match = function (method_name, idx) {
  var pool = this.xhr_pool[method_name];
  return (pool.wait_for_idx === undefined) || (pool.wait_for_idx == idx);
};

BackEndClass.prototype.xhr_pool_remove = function (method_name, idx) {
  this.log_heading5('xhr_pool_remove');

  var pool = this.xhr_pool[method_name];
  delete pool.list[idx];//length will remain unchanged. the given entry become undefined
  pool.count--;
  if (pool.count == 0) {
    //playing safe. check if all entries are actually undefined
    var is_all_undefined = true;
    for (var i = 0; i < pool.list.length; i++) {
      if (pool.list[i]) {
        is_all_undefined = false;
        break;
      }
    }
    if (!is_all_undefined) {
      this.log('warning: not all entries are empty in a pool for method ['+method_name+']');
    }
    //pool.list clear 
    pool.list = [];
  }
  if (pool.count) {
    this.log(this.xhr_pool_toStr('pool dump after', method_name));
  }
  return pool.count;
};

BackEndClass.prototype.xhr_pool_toStr = function (prefix, method_name) {
  var pool = this.xhr_pool[method_name];

  var s = prefix + '. method_name['+method_name+']';
  if (pool) {
    s += ' pool.list.length['+pool.list.length+'] pool.count['+pool.count+']';
    s += pool.wait_for_idx !== undefined ? ' pool.wait_for_idx['+pool.wait_for_idx+']' : '';
    if (pool.list.length > 1) {
      s += '\n';
      for (var i = 0; i < pool.list.length; i++) {
        s += pool.list[i] ? '+' : '.';
      }
    }
  }
  return s;
};

//-   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 

BackEndClass.prototype.XHR_onSettle = function (xhr_obj, is_fulfilled) {
  this.log_heading3('XHR_onSettle. is_fulfilled ['+is_fulfilled+']');
  
  //the flag to call XHR_onReject
  //will =false then calling on_resolve
  var rq_reject = true;
  
  //vars might be used then calling XHR_onReject
  var json_obj;
  
  if (is_fulfilled) {
    var xhr = xhr_obj.xhr;
    
    var handle = xhr_obj.handle;
    
    //-- get JSON 
    if (this.xhr_pool_waitFor_match(handle.method.name, handle.idx)) {
      //usual responseType = json, response class = Object
      var resp_typ = xhr.responseType;
      //=json
      //this.log('responseType ['+resp_typ +']');
      switch (resp_typ) {
        case '':
        case 'text':
          //responseText is only available if responseType is '' or 'text'
          //this.log('----- raw response dump');
          //this.log(xhr.responseText);
          
          try {
            json_obj = JSON.parse(xhr.responseText);
            //json_obj = JSON.parse(decodeURIComponent(xhr.responseText));
            //json_obj = JSON.parse(unescape(xhr.responseText));
          } catch (err) {
            this.log('JSON.parse error: ['+err+']');
            json_obj = null;
          }
          break;
          
        case 'json':
          json_obj = xhr.response;
          //this.log('----- response dump');
          //this.log(xhr.response);
          break;

        default:
          this.log('unsupported responseType ['+xhr.responseType+']');
      }
      
      //-- process the JSON
      if (json_obj && json_obj.result == 1) {
      
        this.log('XHR result = success');
        //this.log(json_obj);
        
        if (handle.method.json_main_key) {
          json_obj = json_obj[handle.method.json_main_key];
        }
        xhr_obj.on_resolve(json_obj);
        rq_reject = false;
      }
    }
  }
  
  //XHR might be rejected on low-level Or on protocol level json.result != 1
  if (rq_reject) {
    this.XHR_onReject(xhr_obj, is_fulfilled, json_obj);
  }
  
  //delete the XHR object from the pool
  this.xhr_pool_remove(handle.method.name, handle.idx);
};

BackEndClass.prototype.XHR_onReject = function (xhr_obj, is_fulfilled, json) {
  this.log_heading4('XHR rejected. is_fulfilled['+is_fulfilled+']');
  
  var txt = this.XHR_debug_onRejectDump_toString(xhr_obj, is_fulfilled, json)
  this.log(txt);
  
  //custom callback for this request
  if (xhr_obj.on_reject) {
    xhr_obj.on_reject();
  }

  //global callback
  if (this.onReject) {
    this.onReject(xhr_obj, txt);
  }
};

BackEndClass.prototype.XHR_debug_onRejectDump_toString = function (xhr_obj, is_fulfilled, json) {
  this.log_heading5('XHR_debug_onRejectDump_toString');
  
  var handle = xhr_obj.handle;
  
  var txt = 'method['+handle.method.name+']\n';
  txt += 'is_fulfilled['+is_fulfilled+']\n';
  
  if (is_fulfilled) {
    txt += '--- json\n';
    txt += JSON.stringify(json, null, 2); // spacing level = 2. don't use toString() here. it is useless
    //this.log('response dump...');
    //this.log(xhr_obj.xhr.response);
  } else {
    txt += 'load_end_conditon['+xhr_obj._load_end_conditon_name+']';
  }
  return txt;
};


//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

BackEndClass.prototype.LinkToShareFromJson = function (json) {
  this.log_heading6('LinkToShareFromJson');

  var consts = this.C.link_to_share;
  var page_uid = json[consts.json_field];
  this.log('page_uid['+page_uid +']');
  var link;

  //sample page_uid 
  //
  //"md_list": "2t6iyc3"
  //obsolete style = "e7b145c8d01f4ee3f1c65357b60c727d"
  
  if (page_uid && page_uid.length) {
    var url = new URL(this.C.protocol + consts.url);
    if (consts.query_param) {
      url.searchParams.append(consts.query_param, page_uid);
    } else {
      url.pathname += page_uid;
    }
    this.log('url.href ['+url.href+']');
    link = url.href;
  }
  
  return link;
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

BackEndClass.prototype._static_properties_init = function () {
  this.log('BackEndClass._static_properties_init');
  
  //autodetect
  this.C.protocol = myUtils.http_protocol_detect();
  //this Might conflict with raw links like href="https://unpkg.com/leaflet@1.5.1....
  //this.C.protocol = 'http';
  //currently not available on the actual hosting. will be in the future
  //this.C.protocol = 'https';
  
  this.C.timeout_delay = 30 * 1000;
    
  /*
  -= ссылка чтобы поделиться =-
  UPD sept10:
  надо поменять ссылку, которая формируется для копирования
  На ссылку следующего формата: http://mini.aurama.ru/p/i68h41l
  Адрес в строке после /p/ , это md_list
  Как она получается? Берем базу http://mini.aurama.ru/p/ и добавляем к ней md_list = i68h41l
  
  3) md_list берем из метода «Поиск оптимального маршрута - distribution_address» 
  4) домен - пока созать констату с таким заничением «http://testtest01.itlogist.ru/api/v1/all/route_md_list/?md_list=»

  По итогу будет что-то типа этого
  http://testtest01.itlogist.ru/api/v1/all/route_md_list/?md_list=msdof9w4jcos9ecso9e
  */
  var share = this.C.link_to_share = {};
  share.json_field = 'md_list';
  share.url = '//mini.aurama.ru/p/';
  share.query_param = '';
  //share.url = '://testtest01.itlogist.ru/api/v1/all/route_md_list/';
  //share.query_param = 'md_list';
};

//=============================================================================
