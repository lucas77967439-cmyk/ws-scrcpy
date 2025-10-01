import { backend, frontend } from './ws-scrcpy.common';
import webpack from 'webpack';

const prodOpts: webpack.Configuration = {
    mode: 'production',
};

const front = () => {
    const cfg = frontend();
    return Object.assign({}, cfg, prodOpts, {
        resolve: {
            ...cfg.resolve,
            fallback: {
                ...cfg.resolve?.fallback,
                querystring: require.resolve('querystring-es3')
            }
        }
    });
};

const back = () => {
    const cfg = backend();
    return Object.assign({}, cfg, prodOpts, {
        resolve: {
            ...cfg.resolve,
            fallback: {
                ...cfg.resolve?.fallback,
                querystring: require.resolve('querystring-es3')
            }
        }
    });
};

module.exports = [front, back];
