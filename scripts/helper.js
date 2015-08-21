
define(['jquery', 'constants'], function($, constants){

return {
    
getTimestampText: function (t, ntf){
	
	//sent ntf as true to get "ago" appended textTimstamp
	var SECONDS_IN_DAY = 24*60*60;
	var miniMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
					  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

	//set timestamps
	var now = Date.now();
	var old = parseInt(t, 10);

	var dateObjNow = new Date(now);
	var dateObjOld = new Date(old*1000);

	//use seconds diff to generate timestamp strings
	now = Math.floor(now/1000);	//convert into seconds
	var diff = now - old;
	var result,
		temp;

	if (diff < SECONDS_IN_DAY){
		if(diff <= 60){
			result = "just a moment ago";
		}

		if(diff > 60 && diff < 3600){
			temp = Math.floor(diff/60);
			result = temp + " mins";
		}

		if(diff >= 3600){
			temp = Math.floor(diff/3600);
			result = temp + " hrs";
		}

		if(temp === 1) {
			//remove the last 's' for '1 mins' or '1 hrs'
			result = result.substring(0, result.length - 1);
		}

		if(ntf && diff > 60) {
			//prepend with 'ago' for notifications timestamp
			result += " ago";
		}

	} else {
		//get local time here
		if (dateObjNow.getFullYear() === dateObjOld.getFullYear()){
			result = dateObjOld.getDate() + " " + miniMonths[dateObjOld.getMonth()];
		} else {
			result = dateObjOld.getDate() + " " + miniMonths[dateObjOld.getMonth()] + ", " + dateObjOld.getFullYear();
		}
	}
	
	return result;
},

getPostNotificationText: function (n){
	
	//can also try to inject html directly
	if (n["type"] === "post"){
		return n.poster_name + " posted in " + n.group_name;
	}
	if (n["type"] === "join"){
		return n.poster_name + " has accepted your request to join "+ n.group_name;
	}
	if (n["type"] === "admin"){
		return n.poster_name + " has accepted your request for adminship of "+ n.group_name;
	}
},

getRequestText : function(req){
	var requestText = "";

	if (req.request_type === "join") {
		requestText = req.user_name + " is wants to join " + req.group_name;
	}
	if (req.request_type === "admin") {
		requestText = req.user_name + " is requsting adminship of " + req.group_name;
	}

	return requestText;
},

getImageURL: function(url, size, type){

    var imageRe = /.(jpg|png|jpeg)$/;
    var urlOriginal = url;
	if (!url){
		if (type === "user"){
		    url = constants.DEFAULT_USER_IMAGE;
		}
		if (type === "group"){
		    url = constants.DEFAULT_GROUP_IMAGE;
		}
	}
	
	if (size !== 0){
	    if (urlOriginal){
	        url = url + "=s" + size + "-c";
	    } else{
	        var index = url.search(imageRe);
	        url = url.substring(0,index) + size + url.substring(index);
	    }
	}
	
	return url
},

checkImageFile: function(file){
	// file is FileList object

	var allowedImageType = {
		"image/jpeg":true,
		"image/png": true,
		"image/jpg": true
	};
	var result = {
		ok: true,
		errorStr: null
	};

	if (!allowedImageType.hasOwnProperty(file[0].type)){
		result.ok = false;
		result.errorStr = "Not a valid image";
	}

	if (file[0].size > constants.MAX_IMAGE_SIZE_BYTES) {
		result.ok = false;
		result.errorStr = "Image file is bigger than 10MB";
	}

	return result;
},

getCharLeft: function (desc) {
	var inputLength = desc.length;
	var charLeft = constants.GROUP_DESCRIPTION_CHAR_LIMIT - inputLength;

	if (charLeft >= 0) {
		return charLeft;
	} else {
		return  charLeft +  "(limit exceeded)";
	}
},

toggleDropdown : function(element) {
	var dropdownWrappers = $(".dropdown-wrapper");

	if (element.hasClass("show")){
		//hiding; simple remove
		element.removeClass("show");
	} else {
		// showing; hide other dropdowns first it visible
		dropdownWrappers.removeClass("show");

		//show the dropdown we want
		element.addClass("show");
	}
},

showDropdown : function (element) {
	//only used in diplaying search results

	var dropdownWrappers = $(".dropdown-wrapper");
	if (!element.hasClass("show")){
		dropdownWrappers.removeClass("show");
		element.addClass("show");
	}
}

}; //end returned module

}); //end define

