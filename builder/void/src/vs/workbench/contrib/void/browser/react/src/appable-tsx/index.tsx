/*--------------------------------------------------------------------------------------
 *  Appable Builder — mount fn. Hands builder + layout services to the React panel.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import * as ReactDOM from 'react-dom/client'
import { ServicesAccessor } from '../../../../../../../editor/browser/editorExtensions.js'
import { IAppableBuilderService } from '../../../../../../../workbench/contrib/void/common/appableBuilderTypes.js'
import { IAppableLayoutService } from '../../../appableLayoutService.js'
import { AppableBuilder } from './AppableBuilder.js'

export const mountAppable = (rootElement: HTMLElement, accessor: ServicesAccessor) => {
	if (typeof document === 'undefined') {
		console.error('appable index.tsx error: document was undefined')
		return
	}
	const appableService = accessor.get(IAppableBuilderService)
	const layoutService = accessor.get(IAppableLayoutService)
	const root = ReactDOM.createRoot(rootElement)
	root.render(<AppableBuilder appableService={appableService} layoutService={layoutService} />)
	return { dispose: () => root.unmount() }
}
