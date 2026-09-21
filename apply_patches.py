#!/usr/bin/env python3
"""Patch OpenWrt source tree to add support for COMFAST CF-WA350."""

import os

BASE = "openwrt"

NETWORK_FILE = (
    f"{BASE}/target/linux/ath79/generic/base-files/etc/board.d/02_network"
)
LEDS_FILE = (
    f"{BASE}/target/linux/ath79/generic/base-files/etc/board.d/01_leds"
)
GENERIC_MK = f"{BASE}/target/linux/ath79/image/generic.mk"
DTS_SRC = "dts/qca9563_comfast_cf-wa350.dts"
DTS_DST = f"{BASE}/target/linux/ath79/dts/qca9563_comfast_cf-wa350.dts"


# ---------------------------------------------------------------------------
# 01_leds — anchor-based injection after telco,t1) block
# ---------------------------------------------------------------------------
def patch_leds():
    if not os.path.exists(LEDS_FILE):
        print("!!! 01_leds not found")
        return

    with open(LEDS_FILE, "r") as f:
        content = f.read()

    if "comfast,cf-wa350)" in content:
        print(">>> 01_leds already patched")
        return

    # Exact anchor block as it appears in 01_leds
    anchor = (
        '\ttelco,t1)\n'
        '\t\tucidef_set_led_switch "lan" "LAN" "blue:lan" "switch0" "0x02"\n'
        '\t\tucidef_set_led_netdev "wan" "WAN" "blue:wan" "eth1"\n'
        '\t\t;;\n'
    )

    injection = (
        '\tcomfast,cf-wa350)\n'
        '\t\tucidef_set_led_netdev "wan" "WAN" "red:wan" "wan"\n'
        '\t\tucidef_set_led_netdev "lan" "LAN" "green:lan" "lan"\n'
        '\t\tucidef_set_led_wlan "wlan5g" "WLAN5G" "blue:wlan5g" "phy0tpt"\n'
        '\t\t;;\n'
    )

    if anchor in content:
        content = content.replace(anchor, anchor + injection, 1)
        with open(LEDS_FILE, "w") as f:
            f.write(content)
        print(">>> 01_leds patched (anchor-based)")
        return

    # Fallback: inject before the last esac
    print("!!! Anchor not found in 01_leds, falling back to esac injection")
    esac_pos = content.rfind("esac")
    if esac_pos == -1:
        print("!!! esac not found in 01_leds")
        return

    content = content[:esac_pos] + injection + '\n\t' + content[esac_pos:]
    with open(LEDS_FILE, "w") as f:
        f.write(content)
    print(">>> 01_leds patched (esac fallback)")


# ---------------------------------------------------------------------------
# 02_network — interfaces: anchor after comfast,cf-e560ac block
# ---------------------------------------------------------------------------
def patch_network():
    if not os.path.exists(NETWORK_FILE):
        print("!!! 02_network not found")
        return

    with open(NETWORK_FILE, "r") as f:
        content = f.read()

    iface_func_pos = content.find("ath79_setup_interfaces")
    macs_func_pos = content.find("ath79_setup_macs")
    if iface_func_pos == -1 or macs_func_pos == -1:
        print("!!! ath79_setup_interfaces / ath79_setup_macs not found")
        return

    iface_block = content[iface_func_pos:macs_func_pos]

    if "comfast,cf-wa350)" in iface_block:
        print(">>> 02_network interfaces already patched")
        return

    anchor = (
        '\tcomfast,cf-e560ac|\\\n'
        '\tqca,ap143-8m|\\\n'
        '\tqca,ap143-16m|\\\n'
        '\ttplink,tl-wr841hp-v3|\\\n'
        '\ttplink,tl-wdr6500-v2)\n'
        '\t\tucidef_set_interface_wan "eth1"\n'
        '\t\tucidef_add_switch "switch0" \\\n'
        '\t\t\t"0@eth0" "1:lan" "2:lan" "3:lan" "4:lan"\n'
        '\t\t;;\n'
    )

    injection = (
        '\tcomfast,cf-wa350)\n'
        '\t\tucidef_set_interfaces_lan_wan "lan" "wan"\n'
        '\t\t;;\n'
    )

    if anchor in iface_block:
        new_block = iface_block.replace(anchor, anchor + injection, 1)
        content = content[:iface_func_pos] + new_block + content[macs_func_pos:]
        with open(NETWORK_FILE, "w") as f:
            f.write(content)
        print(">>> 02_network interfaces patched (anchor-based)")
        return

    # Fallback: inject before the last esac inside ath79_setup_interfaces
    print("!!! Anchor not found, falling back to esac injection")
    esac_pos = iface_block.rfind("esac")
    if esac_pos == -1:
        print("!!! esac not found in ath79_setup_interfaces")
        return

    new_block = (
        iface_block[:esac_pos]
        + injection
        + '\n\t'
        + iface_block[esac_pos:]
    )
    content = content[:iface_func_pos] + new_block + content[macs_func_pos:]
    with open(NETWORK_FILE, "w") as f:
        f.write(content)
    print(">>> 02_network interfaces patched (esac fallback)")


# ---------------------------------------------------------------------------
# 02_network — MACs: extend comfast,cf-e375ac) to also cover cf-wa350
# ---------------------------------------------------------------------------
def patch_network_mac():
    if not os.path.exists(NETWORK_FILE):
        print("!!! 02_network not found for MAC")
        return

    with open(NETWORK_FILE, "r") as f:
        content = f.read()

    macs_pos = content.find("ath79_setup_macs")
    if macs_pos == -1:
        print("!!! ath79_setup_macs not found")
        return

    macs_block = content[macs_pos:]

    if "comfast,cf-wa350)" in macs_block:
        print(">>> 02_network MAC already patched")
        return

    old_entry = (
        '\tcomfast,cf-e375ac)\n'
        '\t\twan_mac=$(macaddr_add $(mtd_get_mac_binary art 0x0) 1)\n'
        '\t\t;;\n'
    )

    new_entry = (
        '\tcomfast,cf-e375ac|\\\n'
        '\tcomfast,cf-wa350)\n'
        '\t\twan_mac=$(macaddr_add $(mtd_get_mac_binary art 0x0) 1)\n'
        '\t\t;;\n'
    )

    if old_entry not in macs_block:
        print("!!! Target block 'comfast,cf-e375ac)' not found in ath79_setup_macs")
        return

    new_macs_block = macs_block.replace(old_entry, new_entry, 1)
    content = content[:macs_pos] + new_macs_block

    with open(NETWORK_FILE, "w") as f:
        f.write(content)
    print(">>> 02_network MAC patched")


# ---------------------------------------------------------------------------
# image/generic.mk — inject device definition after comfast_cf-ew72
# ---------------------------------------------------------------------------
def patch_generic_mk():
    if not os.path.exists(GENERIC_MK):
        print("!!! generic.mk not found")
        return

    with open(GENERIC_MK, "r") as f:
        content = f.read()

    if "comfast_cf-wa350" in content:
        print(">>> generic.mk already patched")
        return

    anchor = "TARGET_DEVICES += comfast_cf-ew72\n"

    injection = (
        '\n'
        'define Device/comfast_cf-wa350\n'
        '  SOC := qca9563\n'
        '  DEVICE_VENDOR := COMFAST\n'
        '  DEVICE_MODEL := CF-WA350\n'
        '  DEVICE_PACKAGES := kmod-ath10k-ct ath10k-firmware-qca9888-ct \\\n'
        '\tkmod-dsa-qca8k kmod-phy-qca83xx cfw-leds -swconfig -uboot-envtools\n'
        '  IMAGE_SIZE := 16000k\n'
        'endef\n'
        'TARGET_DEVICES += comfast_cf-wa350\n'
    )

    if anchor in content:
        content = content.replace(anchor, anchor + injection, 1)
        with open(GENERIC_MK, "w") as f:
            f.write(content)
        print(">>> generic.mk patched (anchor-based)")
        return

    # Fallback: append to end of file
    print("!!! Anchor 'TARGET_DEVICES += comfast_cf-ew72' not found, appending to EOF")
    with open(GENERIC_MK, "a") as f:
        f.write(injection)
    print(">>> generic.mk patched (EOF fallback)")


# ---------------------------------------------------------------------------
# Copy the custom DTS file
# ---------------------------------------------------------------------------
def copy_dts():
    if not os.path.exists(DTS_SRC):
        print("!!! DTS source not found")
        return

    os.makedirs(os.path.dirname(DTS_DST), exist_ok=True)
    with open(DTS_SRC, "r") as f:
        data = f.read()
    with open(DTS_DST, "w") as f:
        f.write(data)
    print(">>> DTS copied")


if __name__ == "__main__":
    copy_dts()
    patch_generic_mk()
    patch_leds()
    patch_network()
    patch_network_mac()
    print(">>> All patches applied!")
