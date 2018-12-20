workflow "publish to npm" {
  on = "push"
  resolves = ["install", "test", "publish"]
}

action "install" {
  uses = "actions/npm@e7aaefe"
  args = "install"
}

action "test" {
  uses = "actions/npm@e7aaefe"
  args = "test"
  needs = ["install"]
}

action "publish" {
  uses = "actions/npm@e7aaefe"
  args = "publish"
  secrets = ["NPM_AUTH_TOKEN"]
  needs = ["test"]
}
