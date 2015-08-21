
requirejs.config({
    paths: { 
        /* Load jquery from google cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery']
    }
});

require(
	['viewmodels/createUser',
	 'libs/domReady!'],
	function(setupCreateUserPage) {	
		setupCreateUserPage();
});