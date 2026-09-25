---
aliases:
  - "04 Authentication"
---
# Native authentication fork

On desktop, this fork invokes your installed Git and leaves authentication to its existing configuration. It does not provide an Obsidian password modal, generate an askpass script, or write credential-response files in the vault.

- HTTPS uses Git's configured `credential.helper`, including Git Credential Manager, GitHub CLI (`gh auth setup-git`), and OS keychains.
- SSH uses your SSH configuration and agent, including `SSH_AUTH_SOCK` and `GIT_SSH_COMMAND`.
- Existing `GIT_ASKPASS`, `SSH_ASKPASS` and `SSH_ASKPASS_REQUIRE` values are respected, not replaced.
- Git has no interactive terminal inside Obsidian. Terminal prompting defaults to disabled unless explicitly configured; missing authentication is an error, not a plugin password prompt.

First confirm that `git fetch` and your normal push work from a terminal in the vault. Obsidian must have access to the same Git executable, helper and environment. A desktop launcher may not inherit shell-only environment variables; launch Obsidian from the working session or set the existing additional PATH/environment options and reload the plugin. Do not enter passwords or tokens into those options. Complete interactive login and SSH host-key verification in the terminal first.

Restart Obsidian after replacing the upstream plugin so its old credential watcher is no longer running. This fork does not delete previously generated files or erase credentials stored by earlier versions; it simply stops creating and using the desktop credential bridge.

This change does not apply to mobile: Android/iOS retain the upstream JavaScript Git backend and credential storage because local Git commands are unavailable there.

# macOS

## HTTPS

Run the following to use the macOS keychain to store your credentials.

```bash
git config --global credential.helper osxkeychain
```

You have to do one authentication action (clone/pull/push) after setting the helper in the terminal. After that you should be able to clone/pull/push in Obsidian without any issues.

## SSH

Remember you still have to setup ssh correctly, like adding your SSH key to the `ssh-agent`. GitHub provides a great documentation on how to [generate a new SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#generating-a-new-ssh-key) and then on how to [add the SSH key to your ssh-agent](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent).

# Windows

## HTTPS

Ensure you are using Git 2.29 or higher and you are using Git Credential Manager as a credential helper. 
You can verify this by executing the following snippet in a terminal, preferably in the directory where your vault/repository is located. It should output `manager`.

```bash
git config credential.helper
```

If this doesn't output `manager`, please run `git config set credential.helper manager`
Just execute any authentication command like push/pull/clone and a pop window should come up, allowing your to sign in.

This fork does not offer the upstream Obsidian password modal. Configure a credential helper or external askpass program instead. Other available credential helpers are listed [here](https://git-scm.com/doc/credential-helpers).

## SSH
Remember you still have to setup ssh correctly, like adding your SSH key to the `ssh-agent`. GitHub provides a great documentation on how to [generate a new SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#generating-a-new-ssh-key) and then on how to [add the SSH key to your ssh-agent](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#adding-your-ssh-key-to-the-ssh-agent).

# Linux

## HTTPS

### Storing

To securely store the username and password permanently without having to reenter it all the time you can use Git's [Credential Helper](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage). `libsecret` stores the password in a secure place. On GNOME it's backed up by [GNOME Keyring](https://wiki.gnome.org/Projects/GnomeKeyring/) and on KDE by [KDE Wallet](https://wiki.archlinux.org/title/KDE_Wallet).
To set `libsecret` as your credential helper execute the following in the terminal from the directory of your vault/repository. You can also add the `--global` flag to set that setting for all other repositories on your device, too.

```bash
git config credential.helper libsecret
```

You have to do one authentication action (clone/pull/push) after setting the helper in the terminal. After that you should be able to clone/pull/push in Obsidian without any issues.

In case you get the message `git: 'credential-libsecret' is not a git command`, libsecret is not installed on your system. You may have to install it by yourself.
Here is an example for Ubuntu.

```bash
sudo apt install libsecret-1-0 libsecret-1-dev make gcc

sudo make --directory=/usr/share/doc/git/contrib/credential/libsecret

# NOTE: This changes your global config, in case you don't want that you can omit the `--global` and execute it in your existing git repository.
git config --global credential.helper \
   /usr/share/doc/git/contrib/credential/libsecret/git-credential-libsecret

```

### SSH_PASS Tools
When Git is not connected to any terminal, so  you can't enter your username/password in the terminal, it relies on the `GIT_ASKPASS`/`SSH_ASKPASS` environment variable to provide an interface to the user to enter those values.

#### Native SSH_ASKPASS
In case you don't want to store it permanently you can install `ksshaskpass` (it's preinstalled on KDE systems) and set it as binary to ask for the password.

To use `ksshaskpass` in Obsidian as the tool for `SSH_ASKPASS` add the following line to the "Additional Environment Variables" in the plugin's settings in the "Advanced" section.

```
SSH_ASKPASS=ksshaskpass
```

You should get a new window to enter your username/password when using a Git action needing authentication now.

#### Obsidian-integrated prompts
The upstream integrated askpass script is removed in this fork. Use a configured credential helper, SSH agent, or external askpass program instead. If your external program requires `SSH_ASKPASS_REQUIRE=force`, configure that explicitly; the plugin no longer forces it.

## SSH
With one of the above [[#SSH_PASS Tools]]  installed to enter your passphrase, you can use ssh with a passphrase. Remember you still have to setup ssh correctly, like adding your SSH key to the `ssh-agent`. GitHub provides a great documentation on how to [generate a new SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=linux#generating-a-new-ssh-key) and then on how to [add the SSH key to your ssh-agent](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=linuxu#adding-your-ssh-key-to-the-ssh-agent).
