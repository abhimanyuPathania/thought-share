# utility handler

import webapp2
import jinja2
import os
import json
import logging

from google.appengine.api import users
from google.appengine.ext import ndb

from models import User

from helper_functions import get_thumbnail_url
from helper_operations import check_user_warm_cache

template_dir = os.path.join(os.path.dirname(__file__), 'templates')
jinja_env = jinja2.Environment(loader = jinja2.FileSystemLoader(template_dir), autoescape=True)

    
# webapp2.RequestHandler.__init__ calls webapp2.RequestHandler.initialize(self.initialize)
# So instead of overriding __init__ method, we can override the initialize.

# So the initialize method defined in Handler class get called by the __init__ method of 
# webapp2.RequestHandler class. Then, the Handler class' initialize at beginning calls 
# the webapp2.RequestHandler.initialize method which adds the basic 'request', 'response' and 'app'
# properties to object(self). Then we proceed to add our custom properties.

# initialize method will be called at every URL request the app routes.

class Handler(webapp2.RequestHandler):
    
	def initialize(self, *a, **kw):
		webapp2.RequestHandler.initialize(self, *a, **kw)

		self.user = None
		self.account = False

		# get user from the appengine's user API
		logged_user = users.get_current_user()

		if logged_user:
			
			# intialize user and user_id properties for rest of app
			self.user = logged_user
			self.user_id = logged_user.user_id()

			# check if user has an account and set the 'account' property to retured boolean
			self.user_key = ndb.Key(User, logged_user.user_id())
			self.account = check_user_warm_cache(self.user_key)

	def write(self, *a, **kw):
		self.response.out.write(*a, **kw)

	def render_str(self, template, **params):
		t = jinja_env.get_template(template)
		
		if self.user:
			# add login/logout URLs accordingly
			params["status_url"] = users.create_logout_url('/')
		else:
			params["status_url"] = users.create_login_url('/feed')
			
		return t.render(params)

	def render(self, template, **kw):
		self.write(self.render_str(template, **kw))

	def render_json(self, d):
		json_txt = json.dumps(d)
		self.response.headers['Content-Type'] = 'application/json; charset=UTF-8'
		self.write(json_txt)

	def fail_ajax(self, response_text=None):
		self.response.status_int = 400;
		self.write(response_text)

	# def delayed_redirect(self, url=None, message=None, delay=None):
	# 	if url==None:
	# 		url = "http://www.linkiful.appspot.com"
	# 	if message == None:
	# 		message = "Some thing went wrong. Please try later\nRedirecting. . . . ."
	# 	if delay == None:
	# 		delay = str(3)

	# 	self.render('redirect.html', redirect_url = url,
	# 								redirect_message = message,
	# 								redirect_delay = delay)

