/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import UrlEntryScreen from '../screens/UrlEntryScreen';
import {DEFAULT_WHIP_URL} from '../urlValidation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'whip-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {
    navigate,
    goBack: () => {},
    addListener: () => () => {},
  } as any;
  const route = {key: 'UrlEntry-test', name: 'UrlEntry' as const} as any;

  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <UrlEntryScreen navigation={navigation} route={route} />,
    );
  });
  return {tree, navigate};
}

describe('UrlEntryScreen', () => {
  it('prefills the input with the default URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'whip-url-input').props.value).toBe(
      DEFAULT_WHIP_URL,
    );
  });

  it('navigates to Publisher with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Publisher', {
      whipUrl: DEFAULT_WHIP_URL,
    });
  });

  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });

  it('shows an error for non-http(s) URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-input').props.onChangeText(
        'ftp://host/x',
      );
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });

  it('clears the error when the URL becomes valid on the next Connect', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'whip-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(hasError(tree.root)).toBe(true);

    ReactTestRenderer.act(() => {
      input.props.onChangeText('https://example.com/whip');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'whip-url-connect').props.onPress();
    });
    expect(hasError(tree.root)).toBe(false);
  });
});
