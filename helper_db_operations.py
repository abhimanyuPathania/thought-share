import time
import logging

from google.appengine.ext import ndb

from models import *
from helper_operations import add_user_name_image

def get_group_feed(group_id, add_poster = True, limit = None, cursor = None):

	group_posts = GroupPost.fetch_posts_by_group(group_id, limit, cursor)
	if not group_posts:
		return None

	feed = []
	user_key_list = []
	for post in group_posts:
		p = post.to_dict()
		p["post_id"] = post.key.urlsafe()
		feed.append(p)

		#also make a list of keys users who posted
		user_key = ndb.Key(User, post.user_id)
		user_key_list.append(user_key)

	#add updated user names and images if add_poster is True
	#added by default
	if add_poster:
		feed = add_user_name_image(feed, user_key_list)

	return feed