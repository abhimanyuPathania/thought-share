

define({
    
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
	}
});