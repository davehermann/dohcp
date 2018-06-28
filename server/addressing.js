function filterIPs(interfaceAddresses, family = `IPv4`) {
    let filteredAddresses = [];

    if (!!interfaceAddresses)
        interfaceAddresses
            .filter(i => { return i.family == family; })
            .forEach(i => { filteredAddresses.push(i); });

    return filteredAddresses;
}

module.exports.FilterIPs = filterIPs;
