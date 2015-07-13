# utility handler

import webapp2
import jinja2
import os
import json
import logging

from google.appengine.api import users
from google.appengine.ext import ndb

from models import User

template_dir = os.path.join(os.path.dirname(__file__), 'templates')
jinja_env = jinja2.Environment(loader = jinja2.FileSystemLoader(template_dir), autoescape=True)

class Handler(webapp2.RequestHandler):
    
	def initialize(self, *a, **kw):
		webapp2.RequestHandler.initialize(self, *a, **kw)
		logged_user = users.get_current_user()
		self.user = logged_user
		if logged_user:
			self.user_id = logged_user.user_id()
			self.user_key = ndb.Key(User, logged_user.user_id())

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

	def delayed_redirect(self, url=None, message=None, delay=None):
		if url==None:
			url = "http://www.linkiful.appspot.com"
		if message == None:
			message = "Some thing went wrong. Please try later\nRedirecting. . . . ."
		if delay == None:
			delay = str(3)

		self.render('redirect.html', redirect_url = url,
									redirect_message = message,
									redirect_delay = delay)
