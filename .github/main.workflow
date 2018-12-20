workflow "publish to npm" {
  on = "push"
  resolves = ["publish"]
}

action "publish" {
  uses = "actions/npm@e7aaefe"
  args = "publish"
  secrets = ["NPM_PUBLISH_SVENKATREDDY_NPM"]
}
