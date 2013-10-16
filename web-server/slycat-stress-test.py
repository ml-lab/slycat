# Copyright 2013, Sandia Corporation. Under the terms of Contract
# DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
# rights in this software.

from selenium import webdriver
from selenium.webdriver.support import expected_conditions
from selenium.webdriver.support.ui import WebDriverWait

import argparse
import getpass
import json
import requests
import time
import urlparse

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="https://localhost:8092", help="Root Slycat URL to test.  Default: %(default)s")
parser.add_argument("--user", default=getpass.getuser(), help="Slycat username.  Default: %(default)s")
arguments = parser.parse_args()

scheme, netloc, path, params, query, fragment = url = urlparse.urlparse(arguments.url)
netloc = "{}:{}@{}".format(arguments.user, getpass.getpass("{} password: ".format(arguments.user)), netloc)
url = urlparse.urlunparse((scheme, netloc, path, params, query, fragment))

try:
  browser = webdriver.Firefox()
except:
  raise Exception("Error starting web browser.  This is likely due to network proxy configuration, try clearing the http_proxy environment variable if set.")

browser.get(url)
WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Projects"))

project_index = 0
while True:
  project_links = browser.find_elements_by_class_name("project-link")
  if project_index >= len(project_links):
    break
  project_link = project_links[project_index % len(project_links)]
  project_link.click()
  WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Project"))

  model_index = 0
  while True:
    model_links = browser.find_elements_by_class_name("model-link")
    if model_index >= len(model_links):
      break
    model_link = model_links[model_index % len(model_links)]
    model_link.click()
    WebDriverWait(browser, 10).until(expected_conditions.title_contains("Model"))
    time.sleep(10)
    browser.back()
    WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Project"))
    model_index += 1

  browser.back()
  WebDriverWait(browser, 10).until(expected_conditions.title_contains("Slycat Projects"))
  project_index += 1
browser.quit()
