---
aliases:
  - 02 Installation
---

> [!important]
> Although the plugin itself is desktop platform independent, an incorrect installation of Obsidian or Git may break the plugin.

## Plugin installation

### With BRAT (this fork)
1. Install and enable BRAT from Obsidian's community plugins.
2. Disable an existing Git plugin before replacing it. Do not uninstall it if you want to keep its settings.
3. In BRAT, select **Add beta plugin** and enter `plastic-karma/obsidian-git`.
4. Install the latest release and restart Obsidian.
5. Enable **Git (Native Auth)** if it is not already enabled.

The fork retains the `obsidian-git` plugin ID and replaces the upstream installation in place. Keep using BRAT for updates; installing/updating Git from the community catalog restores the upstream plugin.

### Manual
1. Download `main.js`, `manifest.json` and `styles.css` from the [latest fork release](https://github.com/plastic-karma/obsidian-git/releases/latest).
2. Place all three files in `<vault>/.obsidian/plugins/obsidian-git`.
3. Restart Obsidian.
4. Disable restricted mode in settings and enable **Git (Native Auth)**.

Desktop authentication uses your existing Git credential helpers and SSH agent, not a plugin password dialog. Follow the [authentication guide](Authentication.md). Mobile retains upstream's separate JavaScript Git and credential handling.

# Windows

Installing [GitHub Desktop](https://github.com/apps/desktop) is **not** enough! You need to install regular Git as well.
## Git installation

> [!info] 
> Ensure you are using Git 2.29 or higher. 

Install Git from the official [website](https://git-scm.com/download/win) with all default settings.
Make sure you have `3rd-party software` access enabled.

![[third-party-windows-git.png]]

Enable Git Credential Manager. You can verify this for existing installations by executing the following. It should ouput `manager`.

```bash
git config credential.helper
```

![[credential-manager-windows-git.png]]


# Linux

## Obsidian installation

Known **supported** Obsidian installation methods:
- AppImage

Known **not fully supported** package managers
- Snap (Snap puts Obsidian in a kind of sandbox, so that Obsidian can't access Git)
- [Flatpak](https://flathub.org/apps/details/md.obsidian.Obsidian) can access Git, but not all system files, so it's not recommended.

If you installed Obsidian a while ago via **Flatpak**, and it doesn't work, please run the following snippet.

```
$ flatpak update md.obsidian.Obsidian
$ flatpak override --reset md.obsidian.Obsidian
$ flatpak run md.obsidian.Obsidian
```
[Source of this snippet](https://github.com/flathub/md.obsidian.Obsidian/issues/5#issuecomment-736974662)

# MacOS

## Git Installation

In order to install `git` on your Mac Computer please follow a suitable route explained in the [Official Git documentation](https://git-scm.com/install/mac)

## Keychain

Run the following to use the macOS keychain to store your credentials.

```zsh
git config --global credential.helper osxkeychain
```

>[!info]
> You have to complete a **single authenticated action** (either clone, pull or push) after setting the helper in the terminal. Once done, you should be able to sync Obsidian without any issues.