import 'babel-polyfill';
import express from 'express';
import { matchRoutes } from 'react-router-config';
import proxy from 'express-http-proxy';
import Routes from './client/Routes';
import renderer from './helpers/renderer';
import createStore from './helpers/createStore';

const app = express();

app.use('/api', proxy('http://react-ssr-api.herokuapp.com', {
	// 2nd option only to match how api was setup **
	proxyReqOptDecorator(opts) {
		opts.headers['x-forwarded-host'] = 'localhost:3000';
		return opts;
	}
}));

// treat as public/static directory
app.use(express.static('public'));

app.get('*', (req, res) => {
	const store = createStore(req);

	const promises = matchRoutes(Routes, req.path).map(({ route }) => {
		return route.loadData ? route.loadData(store) : null;
	}).map(promise => {
		// Make sure all promises complete so 'Promise.all' doesn't break.
		if (promise) {
			return new Promise((resolve, reject) => {
				promise.then(resolve).catch(resolve);
			});
		}
	});

	Promise.all(promises).then(() => {
		const context = {};
		const content = renderer(req, store, context);

		// If not auth'ed (redirected on server side) redirect on client with updated context **
		if (context.url) {
			return res.redirect(301, context.url);
		}

		if (context.notFound) {
			res.status(404);
		}

		// make sure the users browser downloads bundle.js on initial request
		res.send(content);
	});
});

app.listen(3000, () => {
	console.log('listening on port 3000');
});