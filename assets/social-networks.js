'use strict';
//=============================================================================
/*
социальные сети
*/
//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

function SocialNetworksClass(options) {
  //this.C = this.constructor;
  this.C = SocialNetworksClass;//less elegant alternative in case pre-ES6 browsers don't support constructor
  this.SuperClass.static_properties_init.call(this);//can be called only in a special way
  
  this.list_elm = document.getElementById(options.list_id);
  this.item_tag = options.item_tag;
  this.child_tag = options.child_tag;
  this.attribute_name = options.attribute_name;
}

SocialNetworksClass.prototype = new GenericBaseClass();//inherit from
SocialNetworksClass.prototype.SuperClass = GenericBaseClass.prototype;

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

SocialNetworksClass.prototype.LinkToShare_BuildAll = function (link_to_share) {
  this.log('LinkToShare_BuildAll');
  
  if (this.list_elm) {
    var q = this.item_tag;
    q += this.child_tag ? ' ' + this.child_tag  : '';
    var children = this.list_elm.querySelectorAll(q);
  
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var soc_net_name = child.dataset.id;
      //this.log('soc_net_name['+soc_net_name+']');
      var descriptor = this.C.SocialNetworks[soc_net_name];
      var share_url = descriptor.share_link_template.replace('${link_to_share}', link_to_share);
      this.log('share_url['+share_url+']');
      child.href = share_url;
      child.title = descriptor.title;
    }
  }
  
};

//- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

SocialNetworksClass.prototype._static_properties_init = function () {
  this.log('SocialNetworksClass._static_properties_init');
  
  var link_to_share = '';
  
  this.C.SocialNetworks = {
    //--from VK docs
    //http://vk.com/share.php?url={page URL}
    //<a href="http://vk.com/share.php?url=http://mysite.com" target="_blank">Share in VK</a>
    //transformed to 
    //https://oauth.vk.com/authorize?client_id=-1&redirect_uri=https%3A%2F%2Fvk.com%2Fshare.php%3Furl%3Dhttp%3A%2F%2Fmysite.com&display=widget
    //
    //--from youtube
    //https://oauth.vk.com/authorize?client_id=-1&redirect_uri=https://vk.com/share.php?url=https://www.youtube.com/watch?v=QLNQamphldQ&feature=share&display=widget
    vkontakte: {title: 'ВКонтакте', icon: 'vkontakte.svg', 
      share_link_template: 'http://vk.com/share.php?url=${link_to_share}'
    },

    //https://www.facebook.com/sharer/sharer.php?u=https://www.your-domain.com/your-page.html
    //transformed to 
    //https://www.facebook.com/login.php?skip_api_login=1&api_key=966242223397117&signed_next=1&next=https%3A%2F%2Fwww.facebook.com%2Fsharer%2Fsharer.php%3Fu%3Dhttps%253A%252F%252Ftesttest01.itlogist.ru%252Fapi%252Fv1%252Fall%252Froute_md_list%252F%253Fmd_list%253D88515fa178ef3ed3c8df5ec3d7a61536&cancel_url=https%3A%2F%2Fwww.facebook.com%2Fdialog%2Fclose_window%2F%3Fapp_id%3D966242223397117%26connect%3D0%23_%3D_&display=popup&locale=en_US
    //
    //https://www.facebook.com/sharer/sharer.php?
    //kid_directed_site=0
    //&
    //sdk=joey
    //&
    //u=https://www.your-domain.com/your-page.html
    //&
    //display=popup
    //&
    //ref=plugin
    //&
    //src=share_button
    //https://www.facebook.com/login.php?skip_api_login=1&api_key=87741124305&signed_next=1&next=https://www.facebook.com/v2.10/dialog/share?redirect_uri=https://www.youtube.com/facebook_redirect&display=popup&href=https://www.youtube.com/watch?v=QLNQamphldQ&feature=share&client_id=87741124305&ret=login&cancel_url=https://www.youtube.com/facebook_redirect?error_code=4201&error_message=User+canceled+the+Dialog+flow#_=_&display=popup&locale=sv_SE
    facebook: {title: 'Facebook', icon: 'facebook.svg', 
      share_link_template: 'https://www.facebook.com/sharer/sharer.php?u=${link_to_share}'
    },

    //https://connect.ok.ru/offer?url=http://mysite.com
    //transformed to 
    //https://connect.ok.ru/dk?st.cmd=OAuth2Login&st.layout=w&st.redirect=/dk?cmd=WidgetSharePreview&st.cmd=WidgetSharePreview&st.shareUrl=http://mysite.com&st._wt=1&st.client_id=-1
    //
    //--from OK docs
    //You can use “share” without setting a button, for this you need to open a link in following form:
    //    https://connect.ok.ru/offer
    //       ?url=URL_TO_SHARE
    //       &title=TITLE
    //       &imageUrl=IMAGE_URL
    //
    //    Only the url parameter is required, the other parameters are optional.
    //
    //        The ability to know the number of “shares” to your page without setting a button:
    //
    //    https://connect.ok.ru/dk
    //       ?st.cmd=extLike
    //       &tp=json
    //       &ref=URL_TO_SHARE
    //
    //--from youtube
    //https://connect.ok.ru/offer?url=https://www.youtube.com/watch?v=QLNQamphldQ&feature=share&title=LUSTGAS PÅ VOLVO 940 (NOS)
    odnoklasniki: {title: 'Одноклассники', icon: 'odnoklasniki.svg', 
      share_link_template: 'https://connect.ok.ru/offer?url=${link_to_share}'
    },
  };
  
};

//=============================================================================
