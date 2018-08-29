function pathMatch(request, path, action) {
    let idxColon = path.indexOf(`:`),
        idxSlash = path.indexOf(`/`);

    let method = `GET`,
        pathParts = [],
        parameters = {};
    // If a method is provided, remove it from the string
    // Assume all other uses of colon denote optional path segments
    if (idxColon < idxSlash) {
        method = path.substr(0, idxColon);
        pathParts = path.substr(idxColon + 1).split(`/`).filter(part => { return part.length > 0; });
    }

    // Check for a method match
    if (method.toUpperCase() == request.method.toUpperCase()) {
        // Split the URL into segments
        let urlParts = request.url.split(`/`).filter(part => { return part.length > 0; });

        // If there are more URL segments than path segments, it's not a match
        let pathMatches = (pathParts.length >= urlParts.length);

        // Check the path parts to match the URL, and to support optional segments
        for (let idx = 0, total = pathParts.length; idx < total; idx++) {
            if (!pathMatches)
                break;

            let pathSegment = pathParts[idx],
                urlSegment = null,
                isVariable = (pathSegment.substr(0, 1) == `:`),
                isOptional = (pathSegment.substr(pathSegment.length - 1) == `?`);

            // The URL must contain the segment index, or the segment needs to be optional
            if (urlParts.length > idx)
                urlSegment = urlParts[idx];
            else if (!isOptional)
                pathMatches = false;

            if (!isVariable) {
                // If the path segment is not a varial, the URL has to be an exact match
                if (pathSegment !== urlSegment)
                    pathMatches = false;
            } else {
                // Assign the urlSegment to a parameter with the path name
                let variableName = pathSegment.substr(1);
                if (isOptional)
                    variableName = variableName.substr(0, variableName.length - 1);

                parameters[variableName] = urlSegment;
            }
        }

        if (pathMatches)
            action(parameters);
    }
}

module.exports.MatchPath = pathMatch;
