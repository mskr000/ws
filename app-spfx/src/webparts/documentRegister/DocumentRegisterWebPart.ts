import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart, IPropertyPaneConfiguration, PropertyPaneTextField } from '@microsoft/sp-webpart-base';
import { App } from '../../components/App';

export interface IDocumentRegisterWebPartProps {
  siteUrl: string;
}

export default class DocumentRegisterWebPart extends BaseClientSideWebPart<IDocumentRegisterWebPartProps> {
  public render(): void {
    const element = React.createElement(App, { context: this.context, siteUrl: this.properties.siteUrl || '' });
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [{
        header: { description: 'Document Register settings' },
        groups: [{
          groupName: 'Register',
          groupFields: [
            PropertyPaneTextField('siteUrl', {
              label: 'SharePoint site address',
              description: 'The address of the site that holds the register, for example https://yourcompany.sharepoint.com/sites/DocumentRegister',
              placeholder: 'https://',
            }),
          ],
        }],
      }],
    };
  }
}
