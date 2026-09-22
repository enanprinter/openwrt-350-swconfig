include $(TOPDIR)/rules.mk

# Explicit values are required for packages copied directly under package/;
# they prevent luci.mk discovery from depending on the caller's CURDIR.
LUCI_NAME:=luci-theme-enan-dashboard
PKG_NAME:=luci-theme-enan-dashboard
PKG_VERSION:=3.6.4
PKG_RELEASE:=1

LUCI_TITLE:=A-HADDAD Dashboard Theme
LUCI_DEPENDS:=+luci-base +rpcd-mod-luci +ucode-mod-fs +ucode-mod-ubus +ucode-mod-uci +ucode-mod-rtnl +luci-mod-admin-full +luci-mod-network +luci-mod-status +luci-mod-system
LUCI_PKGARCH:=all
# The theme uses modern JavaScript and CSS custom properties. The legacy
# jsmin/csstidy tools emit parse errors or discard unsupported declarations.
LUCI_MINIFY_JS:=0
LUCI_MINIFY_CSS:=0

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=A-HADDAD / Haddad-inc

define Package/luci-theme-enan-dashboard/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.AHADDADDashboard
	uci -q delete luci.themes.ENANDashboard
	uci -q commit luci
}
endef
# The LuCI feed must be installed before compiling this local package.
include $(TOPDIR)/feeds/luci/luci.mk

# The uci-defaults script is shipped in root/etc/uci-defaults and is
# executed once on first boot by OpenWrt's base-files package.

# call BuildPackage - OpenWrt buildroot signature
